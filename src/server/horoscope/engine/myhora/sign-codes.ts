/**
 * รหัสย่อราศีจากตาราง myhora (คอลัมน์ "09 : มก")
 * อ้างอิงผลจริงจาก thai.aspx — กน = กันย์ (ไม่ใช่กุมภ์), กภ = กุมภ์
 */
export const MYHORA_SIGN_ABBR: Record<string, string> = {
  มษ: 'เมษ',
  พษ: 'พฤษภ',
  พภ: 'พฤษภ',
  มถ: 'มิถุน',
  กฎ: 'กรกฎ',
  สห: 'สิงห์',
  กย: 'กันย์',
  กน: 'กันย์',
  ตล: 'ตุลย์',
  พจ: 'พิจิก',
  ธน: 'ธนู',
  มก: 'มกร',
  กภ: 'กุมภ์',
  มี: 'มีน',
  มน: 'มีน',
}

export const MYHORA_PLANET_NUM: Record<number, string> = {
  1: 'อาทิตย์',
  2: 'จันทร์',
  3: 'อังคาร',
  4: 'พุธ',
  5: 'พฤหัสบดี',
  6: 'ศุกร์',
  7: 'เสาร์',
  8: 'ราหู',
  9: 'เกตุ',
  0: 'มฤตยู',
}

export function myhoraAbbrToSign(abbr: string): string {
  const key = abbr.trim()
  return MYHORA_SIGN_ABBR[key] ?? key
}
