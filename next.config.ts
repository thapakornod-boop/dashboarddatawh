import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ปุ่ม "N" ตอน dev ย้ายไปมุมขวา ไม่ให้บังปุ่มออกจากระบบใน sidebar ซ้าย
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
