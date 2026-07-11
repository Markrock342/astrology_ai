/** พิกัดสถานที่เกิด — อ้างอิง myhora + จังหวัดหลักของไทย (สำหรับ engine) */

export interface PlaceCoords {
  lat: number;
  lon: number;
  /** นาทีจาก UTC (ไทย = +420) */
  utcOffsetMinutes: number;
}

const THAILAND_UTC = 420;

/** จังหวัด → อำเภอ/เขต → พิกัด */
const THAI_DISTRICTS: Record<string, Record<string, PlaceCoords>> = {
  กรุงเทพมหานคร: {
    พระนคร: { lat: 13.752555, lon: 100.494066, utcOffsetMinutes: THAILAND_UTC },
    ดุสิต: { lat: 13.772585, lon: 100.519032, utcOffsetMinutes: THAILAND_UTC },
    บางรัก: { lat: 13.729852, lon: 100.526504, utcOffsetMinutes: THAILAND_UTC },
    ปทุมวัน: { lat: 13.746253, lon: 100.534119, utcOffsetMinutes: THAILAND_UTC },
    วัฒนา: { lat: 13.737364, lon: 100.579832, utcOffsetMinutes: THAILAND_UTC },
    คลองเตย: { lat: 13.722684, lon: 100.559063, utcOffsetMinutes: THAILAND_UTC },
    สาทร: { lat: 13.718334, lon: 100.529097, utcOffsetMinutes: THAILAND_UTC },
    บางแค: { lat: 13.6918, lon: 100.407, utcOffsetMinutes: THAILAND_UTC },
    บางขุนเทียน: { lat: 13.6609, lon: 100.4357, utcOffsetMinutes: THAILAND_UTC },
    มีนบุรี: { lat: 13.8137, lon: 100.7485, utcOffsetMinutes: THAILAND_UTC },
    ลาดพร้าว: { lat: 13.8035, lon: 100.6075, utcOffsetMinutes: THAILAND_UTC },
    จตุจักร: { lat: 13.7999, lon: 100.5503, utcOffsetMinutes: THAILAND_UTC },
    ห้วยขวาง: { lat: 13.7693, lon: 100.5777, utcOffsetMinutes: THAILAND_UTC },
    บางเขน: { lat: 13.8739, lon: 100.5964, utcOffsetMinutes: THAILAND_UTC },
    ธนบุรี: { lat: 13.725, lon: 100.485, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 13.756331, lon: 100.501762, utcOffsetMinutes: THAILAND_UTC },
  },
  เชียงใหม่: {
    เมืองเชียงใหม่: { lat: 18.790384, lon: 98.98468, utcOffsetMinutes: THAILAND_UTC },
    หางดง: { lat: 18.687, lon: 98.919, utcOffsetMinutes: THAILAND_UTC },
    สันทราย: { lat: 18.849, lon: 99.044, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 18.788343, lon: 98.985352, utcOffsetMinutes: THAILAND_UTC },
  },
  ขอนแก่น: {
    เมืองขอนแก่น: { lat: 16.441935, lon: 102.835992, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 16.432193, lon: 102.823621, utcOffsetMinutes: THAILAND_UTC },
  },
  นครราชสีมา: {
    เมืองนครราชสีมา: { lat: 14.9799, lon: 102.09777, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 14.9799, lon: 102.09777, utcOffsetMinutes: THAILAND_UTC },
  },
  ชลบุรี: {
    เมืองชลบุรี: { lat: 13.361143, lon: 100.984673, utcOffsetMinutes: THAILAND_UTC },
    บางละมุง: { lat: 12.9236, lon: 100.8825, utcOffsetMinutes: THAILAND_UTC },
    ศรีราชา: { lat: 13.174, lon: 100.928, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 13.361143, lon: 100.984673, utcOffsetMinutes: THAILAND_UTC },
  },
  นนทบุรี: {
    เมืองนนทบุรี: { lat: 13.8621, lon: 100.5144, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 13.8621, lon: 100.5144, utcOffsetMinutes: THAILAND_UTC },
  },
  ปทุมธานี: {
    เมืองปทุมธานี: { lat: 14.0208, lon: 100.525, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 14.0208, lon: 100.525, utcOffsetMinutes: THAILAND_UTC },
  },
  สมุทรปราการ: {
    เมืองสมุทรปราการ: { lat: 13.5991, lon: 100.5998, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 13.5991, lon: 100.5998, utcOffsetMinutes: THAILAND_UTC },
  },
  ภูเก็ต: {
    เมืองภูเก็ต: { lat: 7.8804, lon: 98.3923, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 7.8804, lon: 98.3923, utcOffsetMinutes: THAILAND_UTC },
  },
  สงขลา: {
    เมืองสงขลา: { lat: 7.189, lon: 100.595, utcOffsetMinutes: THAILAND_UTC },
    หาดใหญ่: { lat: 7.0084, lon: 100.4767, utcOffsetMinutes: THAILAND_UTC },
    _default: { lat: 7.189, lon: 100.595, utcOffsetMinutes: THAILAND_UTC },
  },
};

/** จังหวัด → พิกัดเมืองหลัก (ครบทุกจังหวัดใน PROVINCES ที่ใช้บ่อย + ที่เหลือ) */
const THAI_PROVINCE_DEFAULTS: Record<string, PlaceCoords> = {
  กรุงเทพมหานคร: { lat: 13.756331, lon: 100.501762, utcOffsetMinutes: THAILAND_UTC },
  กระบี่: { lat: 8.0863, lon: 98.9063, utcOffsetMinutes: THAILAND_UTC },
  กาญจนบุรี: { lat: 14.0227, lon: 99.5328, utcOffsetMinutes: THAILAND_UTC },
  กาฬสินธุ์: { lat: 16.4322, lon: 103.5061, utcOffsetMinutes: THAILAND_UTC },
  กำแพงเพชร: { lat: 16.4827, lon: 99.5227, utcOffsetMinutes: THAILAND_UTC },
  ขอนแก่น: { lat: 16.432193, lon: 102.823621, utcOffsetMinutes: THAILAND_UTC },
  จันทบุรี: { lat: 12.6113, lon: 102.1038, utcOffsetMinutes: THAILAND_UTC },
  ฉะเชิงเทรา: { lat: 13.6904, lon: 101.0719, utcOffsetMinutes: THAILAND_UTC },
  ชลบุรี: { lat: 13.361143, lon: 100.984673, utcOffsetMinutes: THAILAND_UTC },
  ชัยนาท: { lat: 15.185, lon: 100.125, utcOffsetMinutes: THAILAND_UTC },
  ชัยภูมิ: { lat: 15.8068, lon: 102.0315, utcOffsetMinutes: THAILAND_UTC },
  ชุมพร: { lat: 10.493, lon: 99.18, utcOffsetMinutes: THAILAND_UTC },
  เชียงราย: { lat: 19.9105, lon: 99.8406, utcOffsetMinutes: THAILAND_UTC },
  เชียงใหม่: { lat: 18.788343, lon: 98.985352, utcOffsetMinutes: THAILAND_UTC },
  ตรัง: { lat: 7.5594, lon: 99.6114, utcOffsetMinutes: THAILAND_UTC },
  ตราด: { lat: 12.2428, lon: 102.5175, utcOffsetMinutes: THAILAND_UTC },
  ตาก: { lat: 16.884, lon: 99.125, utcOffsetMinutes: THAILAND_UTC },
  นครนายก: { lat: 14.2069, lon: 101.2131, utcOffsetMinutes: THAILAND_UTC },
  นครปฐม: { lat: 13.8199, lon: 100.0621, utcOffsetMinutes: THAILAND_UTC },
  นครพนม: { lat: 17.4108, lon: 104.7784, utcOffsetMinutes: THAILAND_UTC },
  นครราชสีมา: { lat: 14.9799, lon: 102.09777, utcOffsetMinutes: THAILAND_UTC },
  นครศรีธรรมราช: { lat: 8.4304, lon: 99.9631, utcOffsetMinutes: THAILAND_UTC },
  นครสวรรค์: { lat: 15.7047, lon: 100.1372, utcOffsetMinutes: THAILAND_UTC },
  นนทบุรี: { lat: 13.8621, lon: 100.5144, utcOffsetMinutes: THAILAND_UTC },
  นราธิวาส: { lat: 6.4254, lon: 101.8253, utcOffsetMinutes: THAILAND_UTC },
  น่าน: { lat: 18.783, lon: 100.779, utcOffsetMinutes: THAILAND_UTC },
  บึงกาฬ: { lat: 18.3609, lon: 103.6461, utcOffsetMinutes: THAILAND_UTC },
  บุรีรัมย์: { lat: 14.993, lon: 103.1029, utcOffsetMinutes: THAILAND_UTC },
  ปทุมธานี: { lat: 14.0208, lon: 100.525, utcOffsetMinutes: THAILAND_UTC },
  ประจวบคีรีขันธ์: { lat: 11.812, lon: 99.797, utcOffsetMinutes: THAILAND_UTC },
  ปราจีนบุรี: { lat: 14.0508, lon: 101.372, utcOffsetMinutes: THAILAND_UTC },
  ปัตตานี: { lat: 6.868, lon: 101.25, utcOffsetMinutes: THAILAND_UTC },
  พระนครศรีอยุธยา: { lat: 14.3532, lon: 100.569, utcOffsetMinutes: THAILAND_UTC },
  พังงา: { lat: 8.450, lon: 98.525, utcOffsetMinutes: THAILAND_UTC },
  พัทลุง: { lat: 7.6167, lon: 100.0833, utcOffsetMinutes: THAILAND_UTC },
  พิจิตร: { lat: 16.4429, lon: 100.3488, utcOffsetMinutes: THAILAND_UTC },
  พิษณุโลก: { lat: 16.8211, lon: 100.2659, utcOffsetMinutes: THAILAND_UTC },
  เพชรบุรี: { lat: 13.1119, lon: 99.939, utcOffsetMinutes: THAILAND_UTC },
  เพชรบูรณ์: { lat: 16.419, lon: 101.160, utcOffsetMinutes: THAILAND_UTC },
  แพร่: { lat: 18.1459, lon: 100.141, utcOffsetMinutes: THAILAND_UTC },
  ภูเก็ต: { lat: 7.8804, lon: 98.3923, utcOffsetMinutes: THAILAND_UTC },
  มหาสารคาม: { lat: 16.185, lon: 103.3, utcOffsetMinutes: THAILAND_UTC },
  มุกดาหาร: { lat: 16.545, lon: 104.723, utcOffsetMinutes: THAILAND_UTC },
  แม่ฮ่องสอน: { lat: 19.302, lon: 97.968, utcOffsetMinutes: THAILAND_UTC },
  ยโสธร: { lat: 15.794, lon: 104.145, utcOffsetMinutes: THAILAND_UTC },
  ยะลา: { lat: 6.541, lon: 101.28, utcOffsetMinutes: THAILAND_UTC },
  ร้อยเอ็ด: { lat: 16.0538, lon: 103.652, utcOffsetMinutes: THAILAND_UTC },
  ระนอง: { lat: 9.952, lon: 98.608, utcOffsetMinutes: THAILAND_UTC },
  ระยอง: { lat: 12.6814, lon: 101.2816, utcOffsetMinutes: THAILAND_UTC },
  ราชบุรี: { lat: 13.5283, lon: 99.8134, utcOffsetMinutes: THAILAND_UTC },
  ลพบุรี: { lat: 14.7995, lon: 100.6534, utcOffsetMinutes: THAILAND_UTC },
  ลำปาง: { lat: 18.2888, lon: 99.4909, utcOffsetMinutes: THAILAND_UTC },
  ลำพูน: { lat: 18.5742, lon: 99.0087, utcOffsetMinutes: THAILAND_UTC },
  เลย: { lat: 17.486, lon: 101.722, utcOffsetMinutes: THAILAND_UTC },
  ศรีสะเกษ: { lat: 15.1186, lon: 104.322, utcOffsetMinutes: THAILAND_UTC },
  สกลนคร: { lat: 17.1545, lon: 104.147, utcOffsetMinutes: THAILAND_UTC },
  สงขลา: { lat: 7.189, lon: 100.595, utcOffsetMinutes: THAILAND_UTC },
  สตูล: { lat: 6.6238, lon: 100.0673, utcOffsetMinutes: THAILAND_UTC },
  สมุทรปราการ: { lat: 13.5991, lon: 100.5998, utcOffsetMinutes: THAILAND_UTC },
  สมุทรสงคราม: { lat: 13.4098, lon: 100.002, utcOffsetMinutes: THAILAND_UTC },
  สมุทรสาคร: { lat: 13.5475, lon: 100.274, utcOffsetMinutes: THAILAND_UTC },
  สระแก้ว: { lat: 13.824, lon: 102.0645, utcOffsetMinutes: THAILAND_UTC },
  สระบุรี: { lat: 14.5289, lon: 100.9101, utcOffsetMinutes: THAILAND_UTC },
  สิงห์บุรี: { lat: 14.8878, lon: 100.4017, utcOffsetMinutes: THAILAND_UTC },
  สุโขทัย: { lat: 17.0056, lon: 99.826, utcOffsetMinutes: THAILAND_UTC },
  สุพรรณบุรี: { lat: 14.4744, lon: 100.1177, utcOffsetMinutes: THAILAND_UTC },
  สุราษฎร์ธานี: { lat: 9.1382, lon: 99.3217, utcOffsetMinutes: THAILAND_UTC },
  สุรินทร์: { lat: 14.882, lon: 103.4936, utcOffsetMinutes: THAILAND_UTC },
  หนองคาย: { lat: 17.8782, lon: 102.742, utcOffsetMinutes: THAILAND_UTC },
  หนองบัวลำภู: { lat: 17.204, lon: 102.426, utcOffsetMinutes: THAILAND_UTC },
  อ่างทอง: { lat: 14.5896, lon: 100.455, utcOffsetMinutes: THAILAND_UTC },
  อำนาจเจริญ: { lat: 15.865, lon: 104.626, utcOffsetMinutes: THAILAND_UTC },
  อุดรธานี: { lat: 17.4138, lon: 102.787, utcOffsetMinutes: THAILAND_UTC },
  อุตรดิตถ์: { lat: 17.62, lon: 100.0993, utcOffsetMinutes: THAILAND_UTC },
  อุทัยธานี: { lat: 15.383, lon: 100.0245, utcOffsetMinutes: THAILAND_UTC },
  อุบลราชธานี: { lat: 15.2287, lon: 104.8564, utcOffsetMinutes: THAILAND_UTC },
};

const DEFAULT_THAILAND: PlaceCoords = {
  lat: 13.756331,
  lon: 100.501762,
  utcOffsetMinutes: THAILAND_UTC,
};

export function resolvePlaceCoords(
  country: string,
  province: string,
  district: string,
): PlaceCoords {
  if (country === "ไทย" || country.trim() === "") {
    const prov = province.trim();
    const dist = district.trim();
    const byDistrict = THAI_DISTRICTS[prov];
    if (byDistrict) {
      if (dist && byDistrict[dist]) return byDistrict[dist];
      if (byDistrict._default) return byDistrict._default;
    }
    if (prov && THAI_PROVINCE_DEFAULTS[prov]) return THAI_PROVINCE_DEFAULTS[prov];
    return DEFAULT_THAILAND;
  }
  return DEFAULT_THAILAND;
}
