import { redirect } from 'next/navigation'
import { currentEmployee } from '@/app/lib/session'

// เข้าสู่ระบบอยู่แล้ว → ไป dashboard / ยังไม่ได้เข้า → หน้า login
export default async function Home() {
  redirect((await currentEmployee()) ? '/dashboard' : '/login')
}
