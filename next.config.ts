import type { NextConfig } from "next";

// security headers ทุกหน้า
//   - ห้ามเว็บอื่นเอาหน้าเราไปฝังใน iframe (กัน clickjacking)
//   - ห้ามเบราว์เซอร์เดาชนิดไฟล์เอง · ไม่ส่ง URL เต็ม (มี ?q= ชื่อร้าน) ไปเว็บอื่น · ปิดกล้อง / ไมค์ / ตำแหน่ง
//   - CSP ใส่เฉพาะส่วนที่ไม่กระทบการแสดงผล (ฟอนต์ / สไตล์ inline ยังโหลดได้ตามเดิม)
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // ปุ่ม "N" ตอน dev ย้ายไปมุมขวา ไม่ให้บังปุ่มออกจากระบบใน sidebar ซ้าย
  devIndicators: {
    position: "bottom-right",
  },
  // ไม่บอกว่าเว็บใช้ Next.js (ลดข้อมูลให้คนที่หาช่องโหว่)
  poweredByHeader: false,
  headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
