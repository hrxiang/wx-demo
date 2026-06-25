/**
 * 格式化日期，默认当前时间
 * 
 * 原理：将 format 字符串中的占位符（如 yyyy、MM、dd）替换为对应的日期值
 * 例如：'yyyy-MM-dd' → 先提取年月日得到 { yyyy:'2024', MM:'11', dd:'13' }
 *       → 然后逐个替换 → '2024-11-13'
 *
 * @param date 日期对象、日期字符串、时间戳，为空则取当前时间
 * @param format 格式字符串，如 'yyyy-MM-dd HH:mm:ss'
 * @returns 格式化后的日期字符串，无效日期返回空字符串
 */
export function formatDate(date : Date | string | number | null | undefined, format : string) : string {
	// 第一步：将各种类型的输入统一转为 Date 对象
	let d : Date | null = null;
	if (date instanceof Date) {
		// 传入的本身就是 Date 对象，直接使用
		d = date;
	} else if (typeof date === 'string' || typeof date === 'number') {
		// 传入的是字符串（如 '2024-01-01'）或时间戳（如 1700000000000），用 new Date() 解析
		d = new Date(date);
	}
	// 如果 date 是 null/undefined，d 仍为 null，这里用 ??= 取当前时间作为默认值
	d ??= new Date();

	// 防御：如果传入的字符串无法解析为有效日期（如 'abc'），getTime() 返回 NaN
	if (isNaN(d.getTime())) return '';

	// 第二步：构建「占位符 → 实际值」的映射表
	// 每个 token 对应日期的一个部分，补零版（MM/dd/HH/mm/ss）用 padStart 补齐两位
	// 不补零版（M/d/H/m/s）直接输出数字
	const tokens : Record<string, string> = {
		'yyyy': String(d.getFullYear()),       // 年 → '2024'
		'MM': String(d.getMonth() + 1).padStart(2, '0'), // 月(补零) → '01'~'12'
		'M': String(d.getMonth() + 1),         // 月(不补零) → '1'~'12'
		'dd': String(d.getDate()).padStart(2, '0'),       // 日(补零) → '01'~'31'
		'd': String(d.getDate()),              // 日(不补零) → '1'~'31'
		'HH': String(d.getHours()).padStart(2, '0'),      // 时(补零) → '00'~'23'
		'H': String(d.getHours()),             // 时(不补零) → '0'~'23'
		'mm': String(d.getMinutes()).padStart(2, '0'),    // 分(补零) → '00'~'59'
		'm': String(d.getMinutes()),           // 分(不补零) → '0'~'59'
		'ss': String(d.getSeconds()).padStart(2, '0'),    // 秒(补零) → '00'~'59'
		's': String(d.getSeconds()),           // 秒(不补零) → '0'~'59'
	};

	// 第三步：在 format 字符串中，把每个占位符替换为对应的实际值
	// 举例：format = 'yyyy-MM-dd HH:mm:ss'
	//   第1轮 replaceAll('yyyy', '2024') → '2024-MM-dd HH:mm:ss'
	//   第2轮 replaceAll('MM',   '11')   → '2024-11-dd HH:mm:ss'
	//   第3轮 replaceAll('dd',   '13')   → '2024-11-13 HH:mm:ss'
	//   第4轮 replaceAll('HH',   '09')   → '2024-11-13 09:mm:ss'
	//   第5轮 replaceAll('mm',   '30')   → '2024-11-13 09:30:ss'
	//   第6轮 replaceAll('ss',   '45')   → '2024-11-13 09:30:45'  ← 最终结果
	let result = format;

	// 关键：必须按 token 长度从长到短替换！
	// 如果先替换短的 'M'，那 'MM' 中的第一个 'M' 会被先替换掉，导致结果错误
	// 例如：'MM' → 先替换 'M' 得 '112'（月=11被插入两次）→ 再替换 'M' 混乱
	// 按长度降序：先替换 'MM'(长度2)，再替换 'M'(长度1)，就不会互相干扰
	const sortedKeys = Object.keys(tokens).sort((a, b) => b.length - a.length);
	for (const key of sortedKeys) {
		result = result.replaceAll(key, tokens[key]);
	}
	return result;
}
// ==================== 日期比较（通用） ====================

/**
 * 将 Date / string / number 统一转为 Date 对象，无效输入返回 null
 */
function toDate(value : Date | string | number) : Date | null {
	if (value instanceof Date) return value;
	if (typeof value === 'string' || typeof value === 'number') {
		const d = new Date(value);
		return isNaN(d.getTime()) ? null : d;
	}
	return null;
}

/**
 * 判断两个日期是否是同一天
 * @param date1 日期对象、日期字符串或时间戳
 * @param date2 日期对象、日期字符串或时间戳，默认当前时间
 * @returns 是否是同一天
 */
export function isSameDay(date1 : Date | string | number, date2 : Date | string | number = new Date()) : boolean {
	const a = toDate(date1);
	const b = toDate(date2);
	if (!a || !b) return false;
	return a.getFullYear() === b.getFullYear()
		&& a.getMonth() === b.getMonth()
		&& a.getDate() === b.getDate();
}

/**
 * 判断两个日期是否是同一月
 * @param date1 日期对象、日期字符串或时间戳
 * @param date2 日期对象、日期字符串或时间戳，默认当前时间
 * @returns 是否是同一月
 */
export function isSameMonth(date1 : Date | string | number, date2 : Date | string | number = new Date()) : boolean {
	const a = toDate(date1);
	const b = toDate(date2);
	if (!a || !b) return false;
	return a.getFullYear() === b.getFullYear()
		&& a.getMonth() === b.getMonth();
}

/**
 * 判断两个日期是否是同一年
 * @param date1 日期对象、日期字符串或时间戳
 * @param date2 日期对象、日期字符串或时间戳，默认当前时间
 * @returns 是否是同一年
 */
export function isSameYear(date1 : Date | string | number, date2 : Date | string | number = new Date()) : boolean {
	const a = toDate(date1);
	const b = toDate(date2);
	if (!a || !b) return false;
	return a.getFullYear() === b.getFullYear();
}

// ==================== 日期比较（快捷） ====================

/**
 * 判断是否是今天（等价于 isSameDay(date, now)）
 * @param date 日期对象、日期字符串或时间戳
 * @returns 是否是今天
 */
export function isToday(date : Date | string | number) : boolean {
	return isSameDay(date);
}

/**
 * 判断是否是当月（等价于 isSameMonth(date, now)）
 * @param date 日期对象、日期字符串或时间戳
 * @returns 是否是当月
 */
export function isCurrentMonth(date : Date | string | number) : boolean {
	return isSameMonth(date);
}

/**
 * 判断是否是当年（等价于 isSameYear(date, now)）
 * @param date 日期对象、日期字符串或时间戳
 * @returns 是否是当年
 */
export function isCurrentYear(date : Date | string | number) : boolean {
	return isSameYear(date);
}

/**
 * 递进判断两个日期的年、月、日是否相同
 * 返回 [同年, 同年且同月, 同年且同月且同日]
 * 一次调用即可得到三级递进结果，无需分别调用 isSameYear/isSameMonth/isSameDay
 * @param date1 日期对象、日期字符串或时间戳
 * @param date2 日期对象、日期字符串或时间戳，默认当前时间
 * @returns [同年, 同年且同月, 同年且同月且同日]
 */
export function isSameYMD(date1 : Date | string | number, date2 : Date | string | number = new Date()) : [boolean, boolean, boolean] {
	const a = toDate(date1);
	const b = toDate(date2);
	if (!a || !b) return [false, false, false];

	const sameYear = a.getFullYear() === b.getFullYear();
	// 年相同才比月，月相同才比日（递进）
	const sameMonth = sameYear && a.getMonth() === b.getMonth();
	const sameDay = sameMonth && a.getDate() === b.getDate();
	return [sameYear, sameMonth, sameDay];
}

/**
 * 调整日期（自动识别 yyyy / yyyy-MM / yyyy-MM-dd 格式，按对应粒度加减）
 *
 * 根据输入格式自动判断调整粒度：
 *   - 'yyyy-MM-dd' → 加减天数
 *   - 'yyyy-MM'    → 加减月数
 *   - 'yyyy'       → 加减年数
 *
 * @param dateStr 日期字符串，支持 yyyy / yyyy-MM / yyyy-MM-dd
 * @param offset 偏移量，正数向后，负数向前（如 -3 表示往前3个单位）
 * @returns 调整后的日期字符串，格式与输入一致
 */
export function adjustDate(dateStr : string, offset : number) : string {
	const parts = dateStr.split('-');
	const year = parseInt(parts[0]);
	const month = parts[1] ? parseInt(parts[1]) : null;
	const day = parts[2] ? parseInt(parts[2]) : null;

	if (day !== null) {
		// yyyy-MM-dd → 按天调整
		const date = new Date(year, month! - 1, day);
		date.setDate(date.getDate() + offset);
		return formatDate(date, 'yyyy-MM-dd');
	} else if (month !== null) {
		// yyyy-MM → 按月调整
		const date = new Date(year, month - 1, 1);
		date.setMonth(date.getMonth() + offset);
		return formatDate(date, 'yyyy-MM');
	} else {
		// yyyy → 按年调整
		return `${year + offset}`;
	}
}

/**
 * 比较两个日期的先后（类似 localeCompare 的返回值约定）
 *
 * @param dateA 日期对象、日期字符串或时间戳
 * @param dateB 日期对象、日期字符串或时间戳
 * @returns 1: A>B, -1: A<B, 0: A=B, null: 无效日期
 */
export function compareDate(dateA : Date | string | number, dateB : Date | string | number) : number | null {
	const a = toDate(dateA);
	const b = toDate(dateB);

	if (!a || !b) return null;

	const diff = a.getTime() - b.getTime();
	if (diff > 0) return 1;   // A 晚于 B
	if (diff < 0) return -1;  // A 早于 B
	return 0;                 // A 等于 B
}

/**
 * 获取星期几的中文名称
 * @param date 日期对象、日期字符串或时间戳
 * @returns 如 '星期六'，无效日期返回空字符串
 */
export function getWeekdayName(date : Date | string | number) : string {
	const d = toDate(date);
	if (!d) return '';
	const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
	return weekdays[d.getDay()];
}

/**
 * 获取中文完整日期 + 星期几（如 '2024年06月15日 星期六'）
 * @param date 日期对象、日期字符串或时间戳
 * @param format 日期部分格式，默认 'yyyy年MM月dd日'
 * @returns 完整日期 + 星期，无效日期返回空字符串
 */
export function getWeekday(date : Date | string | number, format : string = 'yyyy年MM月dd日') : string {
	const d = toDate(date);
	if (!d) return '';
	const weekday = getWeekdayName(d);
	return formatDate(d, format) + ' ' + weekday;
}

/**
 * 计算两个日期的差值（按指定粒度：年/月/日）
 *
 * 原理：
 *   年差 = currentYear - selectedYear
 *   月差 = 两个日期各自转为「年×12+月」再相减，如 2024-03 与 2025-01 → (2025×12+1)-(2024×12+3) = 10
 *   日差 = 用 UTC 时间戳相减再除以 86400000（一天的毫秒数），避免时区影响
 *
 * @param date1 起始日期，支持 Date / string / number
 * @param date2 截止日期，支持 Date / string / number
 * @param unit 粒度：'year' | 'month' | 'day'
 * @returns 差值（正数表示 date2 在后，负数表示在前）
 */
export function diffDate(date1 : Date | string | number, date2 : Date | string | number, unit : 'year' | 'month' | 'day') : number {
	const a = toDate(date1);
	const b = toDate(date2);
	if (!a || !b) return 0;

	switch (unit) {
		case 'year':
			return b.getFullYear() - a.getFullYear();
		case 'month':
			// 将日期转为「年×12+月」的绝对月数，再相减
			return (b.getFullYear() * 12 + b.getMonth() + 1) - (a.getFullYear() * 12 + a.getMonth() + 1);
		case 'day': {
			// 用 UTC 时间戳计算天数差，避免夏令时等时区问题
			const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
			const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
			return Math.floor((utcB - utcA) / (86400 * 1000));
		}
		default:
			return 0;
	}
}

/**
 * 解析短格式日期字符串为完整 Date 对象
 *
 * 将不完整的日期补全后再解析：
 *   '2024'     → 2024-01-01
 *   '2024-06'  → 2024-06-01
 *   '2024-06-15' → 原样解析
 *
 * 为什么需要补全？因为 new Date('2024') 在不同平台可能解析为时间偏移而非年份
 *
 * @param dateStr 日期字符串（yyyy / yyyy-MM / yyyy-MM-dd）
 * @returns Date 对象，无效日期返回 null
 */
export function parseShortDate(dateStr : string) : Date | null {
	let str = dateStr;
	if (str.length === 4) str += '-01-01';
	else if (str.length === 7) str += '-01';
	const d = new Date(str);
	return isNaN(d.getTime()) ? null : d;
}

/**
 * 判断日期更靠近区间的哪一端
 *
 * 计算目标日期与起始端、结束端的时间差，返回更靠近的一端
 *
 * @param date 目标日期，支持 Date / string / number
 * @param start 区间起始端，默认 '2000-01-01'
 * @param end 区间结束端，默认当前时间
 * @returns 'start': 更靠近起始端, 'end': 更靠近结束端, null: 无效日期
 */
export function closerToEnd(date : Date | string | number, start : Date | string | number = '2000-01-01', end ?: Date | string | number) : 'start' | 'end' | null {
	const target = toDate(date) || parseShortDate(String(date));
	const startD = toDate(start) || parseShortDate(String(start));
	const endD = end ? (toDate(end) || parseShortDate(String(end))) : new Date();

	if (!target || !startD || !endD) return null;

	const targetTime = target.getTime();
	const diffStart = Math.abs(targetTime - startD.getTime());
	const diffEnd = Math.abs(targetTime - endD.getTime());

	return diffStart <= diffEnd ? 'start' : 'end';
}

/**
 * 生成时间刻度列表
 *
 * 在指定的时间范围内，按固定间隔生成时间刻度字符串数组
 * 常用于图表 X 轴刻度、时间轴标签等场景
 *
 * 示例：
 *   generateTimeTicks({ startTime: '08:00', endTime: '12:00', stepMinutes: 60 })
 *   → ['08:00', '09:00', '10:00', '11:00']
 *
 *   generateTimeTicks({ startTime: '08:00', endTime: '10:00', stepMinutes: 30, includeEnd: true })
 *   → ['08:00', '08:30', '09:00', '09:30', '10:00']
 *
 * @param options.startTime 起始时间，默认 '01:00'
 * @param options.endTime 结束时间，默认 '24:00'（支持 '24:00' 表示午夜）
 * @param options.stepMinutes 步长（分钟），默认 60
 * @param options.format 输出格式，支持 'HH:mm'/'HH'/'H'/'H:m'，默认 'HH:mm'
 * @param options.includeEnd 是否包含结束时间，默认 false
 * @returns 时间刻度字符串数组
 */
export function generateTimeTicks(options : {
	startTime ?: string;
	endTime ?: string;
	stepMinutes ?: number;
	format ?: string;
	includeEnd ?: boolean;
} = {}) : string[] {
	const {
		startTime = '01:00',
		endTime = '24:00',
		stepMinutes = 60,
		format = 'HH:mm',
		includeEnd = false
	} = options;

	const ticks : string[] = [];

	/** 将 'HH:mm' 格式转为当天的总分钟数 */
	function timeToMinutes(timeStr : string) : number {
		if (timeStr === '24:00') return 24 * 60; // 特殊处理 24:00（表示午夜）
		const [hours, minutes] = timeStr.split(':').map(Number);
		return hours * 60 + (minutes || 0);
	}

	/** 将总分钟数转为指定格式的时间字符串 */
	function formatTime(totalMinutes : number, formatType : string) : string {
		let hours = Math.floor(totalMinutes / 60) % 24;
		const minutes = totalMinutes % 60;

		// 特殊处理 24:00（午夜）
		if (totalMinutes === 24 * 60) {
			hours = 24;
		}

		switch (formatType) {
			case 'H':
				return `${hours}`;
			case 'HH':
				return `${hours.toString().padStart(2, '0')}`;
			case 'H:M':
			case 'H:m':
				return `${hours}:${minutes}`;
			default: // 'HH:mm'
				return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
		}
	}

	const startMinutes = timeToMinutes(startTime);
	const endMinutes = timeToMinutes(endTime);
	let currentMinutes = startMinutes;

	// 按步长生成刻度，直到接近结束时间
	while (currentMinutes < endMinutes) {
		ticks.push(formatTime(currentMinutes, format));
		currentMinutes += stepMinutes;
		// 防止因浮点数精度问题导致无限循环
		if (currentMinutes > endMinutes + stepMinutes) {
			break;
		}
	}

	// 如果需要包含结束时间，且最后一个刻度未达到结束时间，补上
	if (includeEnd) {
		const lastTickMinutes = ticks.length > 0
			? timeToMinutes(ticks[ticks.length - 1])
			: startMinutes;
		if (lastTickMinutes < endMinutes || ticks.length === 0) {
			ticks.push(formatTime(endMinutes, format));
		}
	}
	return ticks;
}