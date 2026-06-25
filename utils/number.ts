/**
 * 数字格式化工具
 *
 * 提供精确的小数位数控制，解决 JavaScript 浮点数精度问题（如 0.1 + 0.2 !== 0.3）
 */

/**
 * 精确舍入（内部辅助方法）
 *
 * 原理：先放大 10^n 倍 → toFixed 消除中间浮点误差 → Math.round 舍入 → 再缩小回来
 *
 * 为什么不直接用 num.toFixed(n)？
 *   因为 (1.005).toFixed(2) 返回 "1.00" 而非 "1.01"，这是浮点精度丢失导致的。
 *   本方法通过先放大再 toFixed(10) 固定中间精度，绕过此问题。
 *
 * @param num 待舍入的数字
 * @param fractionDigits 保留的小数位数
 * @returns 舍入后的数字
 *
 * @example
 * preciseRound(1.005, 2)  // 1.01  （原生 toFixed 会错误返回 1.00）
 * preciseRound(2.345, 2)  // 2.35
 * preciseRound(2.344, 2)  // 2.34
 */
function preciseRound(num : number, fractionDigits : number) : number {
	const multiplier = Math.pow(10, fractionDigits);
	// toFixed(10) 固定中间结果到 10 位小数，消除放大时的浮点误差
	const fixedNum = (num * multiplier).toFixed(10);
	return Math.round(Number(fixedNum)) / multiplier;
}

/**
 * 截断小数到指定位数（不四舍五入，直接丢弃多余位）
 *
 * @param decimalStr 小数部分字符串
 * @param fractionDigits 保留的小数位数
 * @returns 截断后的字符串，如 "3.14"
 *
 * @example
 * truncateDecimal("14159", 2)  // "3.14" → 由调用方拼接整数部分
 */
function truncateDecimal(integerPart : string, decimalStr : string, fractionDigits : number) : string {
	return integerPart + '.' + decimalStr.substring(0, fractionDigits);
}

/**
 * 格式化数字的小数位数
 *
 * 支持「四舍五入」和「直接截断」两种模式，自动处理浮点精度问题。
 *
 * @param value 待格式化的数字，支持 string | number
 * @param fractionDigits 保留的小数位数
 * @param rounding 是否四舍五入，默认 true；false 时直接截断（向下取整）
 * @returns 格式化后的字符串；无法解析时返回原值的字符串形式
 *
 * @example
 * formatDecimal('3.14159', 2)           // '3.14'  （四舍五入）
 * formatDecimal('3.14159', 2, false)     // '3.14'  （直接截断）
 * formatDecimal('3.146', 2)             // '3.15'  （四舍五入）
 * formatDecimal('3.144', 2)             // '3.14'
 * formatDecimal('3.1', 2)               // '3.1'   （不足位数不补零）
 * formatDecimal(1.005, 2)               // '1.01'  （精确舍入，原生 toFixed 会出错）
 * formatDecimal('abc', 2)               // 'abc'   （无法解析，原样返回）
 */
export function formatDecimal(value : string | number, fractionDigits : number, rounding : boolean = true) : string {
	const str = String(value);

	// 空值或不含小数点，无需处理
	if (!str || !str.includes('.')) {
		return str;
	}

	const parts = str.split('.');
	const integerPart = parts[0];
	const decimalPart = parts[1];

	// 小数位数未超过指定精度，无需截断
	if (decimalPart.length <= fractionDigits) {
		return str;
	}

	if (rounding) {
		const num = parseFloat(str);
		if (isNaN(num)) {
			return str;
		}
		return preciseRound(num, fractionDigits).toString();
	}

	// 直接截断，不四舍五入
	return truncateDecimal(integerPart, decimalPart, fractionDigits);
}

/**
 * 格式化为两位小数（formatDecimal 的快捷方式）
 *
 * @param value 待格式化的数字
 * @param rounding 是否四舍五入，默认 true
 * @returns 格式化后的字符串
 *
 * @example
 * toFixed2(3.14159)       // '3.14'
 * toFixed2('3.146')       // '3.15'
 * toFixed2('3.146', false) // '3.14'（截断）
 */
export function toFixed2(value : string | number, rounding : boolean = true) : string {
	return formatDecimal(value, 2, rounding);
}
