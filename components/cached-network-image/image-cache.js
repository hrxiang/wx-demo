class ImageCache {
	constructor() {
		this.MAX_CACHE_SIZE = 5 * 1024 * 1024; // 最大缓存 5MB
		this.lruMap = new Map(JSON.parse(wx.getStorageSync('lruImageMap') || '[]'));
	}

	// 核心方法：获取图片路径（缓存命中直接返回，未命中则下载+缓存）
	async getCachedImage(url) {
		// 1. 检查缓存是否存在
		if (this.lruMap.has(url)) {
			const entry = this.lruMap.get(url);
			entry.lastAccess = Date.now(); // 更新访问时间
			this._saveLruMap();
			return entry.path; // 返回缓存路径
		}
		try {
			// 2. 下载图片到临时路径
			const tempFilePath = await this._downloadFile(url);
			// 3. 预检空间是否足够（关键优化）
			const tempFileSize = await this._getFileSize(tempFilePath);
			const hasSpace = await this._ensureFreeSpace(tempFileSize);
			if (!hasSpace) throw new Error('CACHE_FULL Not enough space!');
			// 4. 保存文件并更新缓存
			const fileName = this._generateFileName(url);
			// const fileName = url.split('/').pop();
			const savePath = `${wx.env.USER_DATA_PATH}/${Date.now()}_${fileName}`;
			await this._saveFile(tempFilePath, savePath);
			// 5. 更新lrumap
			this.lruMap.set(url, {
				path: savePath,
				size: tempFileSize,
				lastAccess: Date.now()
			});
			this._saveLruMap();
			return savePath;
		} catch (err) {
			console.warn(`【image-cache】缓存失败降级使用网络URL ${url}`, err);
			return url; // 降级策略：返回原始URL确保显示
		}
	}

	// 下载url图片
	async _downloadFile(url) {
		const {
			tempFilePath
		} = await new Promise((resolve, reject) => {
			wx.downloadFile({
				url,
				success: resolve,
				fail: reject,
			})
		});
		return tempFilePath;
	}

	// 辅助方法：保存文件到本地
	async _saveFile(tempPath, savePath) {
		const fs = wx.getFileSystemManager();
		await new Promise((resolve, reject) => {
			fs.saveFile({
				tempFilePath: tempPath,
				filePath: savePath,
				success: resolve,
				fail: reject,
			});
		});
	}

	// 辅助方法：获取文件大小
	async _getFileSize(path) {
		const fs = wx.getFileSystemManager();
		const {
			size
		} = await new Promise((resolve, reject) => {
			fs.stat({
				path,
				success: res => resolve(res.stats),
				fail: reject,
			})
		});
		return size;
	}

	// 辅助方法：确保空闲空间（写入前预检）
	async _ensureFreeSpace(requiredSize) {
		// 1. 计算当前图片缓存总大小（逻辑池）
		let cachePoolSize = 0;
		for (const entry of this.lruMap.values()) {
			cachePoolSize += entry.size;
		}

		// 2. 获取微信物理空间信息
		let remainingPhysicalSpace = 0;
		const {
			currentSize,
			limitSize
		} = wx.getStorageInfoSync();
		remainingPhysicalSpace = limitSize * 1024 - currentSize * 1024; // 转为字节

		// 3. 校验逻辑池空间（优先满足用户设置）
		if (cachePoolSize + requiredSize <= this.MAX_CACHE_SIZE) {
			// 逻辑池空间充足 → 继续校验物理空间
			if (remainingPhysicalSpace >= requiredSize) {
				return true; // 双重满足
			}
		}

		// 4. 空间不足 → 按LRU清理逻辑池文件
		const sortedEntries = [...this.lruMap.entries()]
			.sort((a, b) => a[1].lastAccess - b[1].lastAccess);

		while (sortedEntries.length > 0) {
			const [oldestUrl, entry] = sortedEntries.shift();

			// 删除文件并更新统计
			try {
				wx.getFileSystemManager().unlinkSync(entry.path);
				this.lruMap.delete(oldestUrl);
				cachePoolSize -= entry.size; // 更新逻辑池大小
				remainingPhysicalSpace += entry.size; // 更新验物理空间
			} catch (e) {
				/* 错误处理 */
			}

			// 校验是否满足双重条件
			const logicSpaceOk = cachePoolSize + requiredSize <= this.MAX_CACHE_SIZE;
			const physicalSpaceOk = remainingPhysicalSpace >= requiredSize;
			if (logicSpaceOk && physicalSpaceOk) break;
		}

		this._saveLruMap();

		// 5. 最终确认（动态获取最新空间信息）
		const {
			currentSize: finalCurrentSize,
			limitSize: finalLimitSize
		} = wx.getStorageInfoSync();
		const finalRemainingSpace = finalLimitSize * 1024 - finalCurrentSize * 1024;

		return (cachePoolSize + requiredSize <= this.MAX_CACHE_SIZE) &&
			(finalRemainingSpace >= requiredSize);
	}

	// 辅助方法：保存LRU映射到Storage
	_saveLruMap() {
		wx.setStorageSync('lruImageMap', JSON.stringify([...this.lruMap]));
	}

	// 清除所有缓存（扩展方法）
	clearAllCache() {
		const fs = wx.getFileSystemManager();
		for (const [url, entry] of this.lruMap) {
			try {
				fs.unlinkSync(entry.path);
			} catch (e) {
				console.error(`删除文件失败: ${entry.path}`, e);
			}
		}
		this.lruMap.clear();
		wx.removeStorageSync('lruImageMap');
	}

	// md5加密处理
	_generateMD5Key(url) {
		const hexChars = '0123456789abcdef';
		let hash = 0;
		for (let i = 0; i < url.length; i++) {
			hash = (hash << 5) - hash + url.charCodeAt(i);
			hash |= 0; // 转换为 32 位整数
		}
		let result = '';
		for (let i = 0; i < 16; i++) {
			const value = (hash >> (i * 2)) & 0xff;
			result += hexChars.charAt((value >> 4) & 0xf) + hexChars.charAt(value & 0xf);
		}
		return result;
	}

	//生成扩展名
	_getFileExtension(url) {
		// 提取路径的最后一部分，确保获取文件名
		let filename = url.split('/').pop();
		// 检查是否有扩展名并返回
		let extension = filename.includes('.') ? filename.split('.').pop() : null;
		console.log("【image-cache】生成扩展名----", extension);
		return extension;
	}

	//生成文件名
	_generateFileName(url, filename, extension) {
		const name = filename ?? this._generateMD5Key(url);
		const ext = extension ?? this._getFileExtension(url);

		if (ext) {
			return name + "." + ext; // 使用 MD5 生成文件名
		} else {
			return name;
		}
	}
}

export default new ImageCache();