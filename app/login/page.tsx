'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { closeLoading, showError, showLoading } from '@/app/components/Loading'
import { login } from './actions'

// รหัสพนักงาน: อังกฤษ 3 ตัว + ตัวเลข 4 ตัว เช่น SDO1234
const CODE_RE = /^[A-Z]{3}\d{4}$/
const REMEMBER_KEY = 'rsm_remember_code'

// บันทึก / ดึงรหัสผ่านผ่านตัวจัดการรหัสผ่านของเบราว์เซอร์ (Credential Management API)
// เบราว์เซอร์เก็บแบบเข้ารหัสเอง เว็บไม่เก็บเลขบัตรไว้เอง — รองรับ Chrome / Edge / Opera
// ส่วน Safari / Firefox จะเสนอ "บันทึกรหัสผ่าน" เองจาก autoComplete ของช่องกรอก
type PasswordCred = Credential & { password?: string }
type PasswordCredCtor = new (data: { id: string; password: string; name?: string }) => Credential
const PasswordCredential = () =>
  typeof window !== 'undefined' ? (window as unknown as { PasswordCredential?: PasswordCredCtor }).PasswordCredential : undefined

async function saveToBrowser(code: string, idCard: string, name: string) {
  const Ctor = PasswordCredential()
  if (!Ctor || !navigator.credentials) return
  try { await navigator.credentials.store(new Ctor({ id: code, password: idCard, name })) } catch { /* ผู้ใช้กดไม่บันทึก */ }
}

async function loadFromBrowser(): Promise<{ code: string; idCard: string } | null> {
  if (!PasswordCredential() || !navigator.credentials) return null
  try {
    const c = (await navigator.credentials.get({ password: true, mediation: 'optional' } as CredentialRequestOptions)) as PasswordCred | null
    return c?.type === 'password' && c.password ? { code: c.id, idCard: c.password } : null
  } catch {
    return null
  }
}

const noopSubscribe = () => () => {}
function readSavedCode() {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? ''
  } catch {
    return '' // เบราว์เซอร์ปิด storage ไว้ก็ไม่เป็นไร
  }
}

// ริบบิ้นโค้งลอยตกแต่ง background (SVG เส้นหนา ปลายมน ไล่สี)
function Squiggle({ className, d, gradientId, colors }: {
  className?: string
  d: string
  gradientId: string
  colors: [string, string]
}) {
  return (
    <svg className={className} viewBox="0 0 200 200" fill="none">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="200" y2="200">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <path
        d={d}
        stroke={`url(#${gradientId})`}
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  // รหัสพนักงานที่เคยจดจำไว้ในเครื่องนี้ (ฝั่ง server = ว่าง) ใช้เป็นค่าเริ่มต้นจนกว่าจะพิมพ์เอง
  const savedCode = useSyncExternalStore(noopSubscribe, readSavedCode, () => '')
  const [typedId, setEmployeeId] = useState<string | null>(null)
  const [rememberPick, setRemember] = useState<boolean | null>(null)
  const employeeId = typedId ?? savedCode
  const remember = rememberPick ?? savedCode !== ''
  const [idCard, setIdCard] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // โหลดโครงหน้า dashboard ไว้ก่อน + ปิด loading ที่ค้างมาจากการออกจากระบบ
  useEffect(() => {
    closeLoading()
    router.prefetch('/dashboard')
  }, [router])

  // เคยติ๊ก "จดจำฉัน" ไว้ → ดึงรหัสพนักงาน + เลขบัตรที่บันทึกในเบราว์เซอร์มาเติมให้
  useEffect(() => {
    if (!savedCode) return
    loadFromBrowser().then((cred) => {
      if (!cred) return
      setEmployeeId(cred.code)
      setIdCard(cred.idCard.replace(/\D/g, '').slice(0, 13))
    })
  }, [savedCode])

  // ตรวจรูปแบบก่อนส่ง (server ตรวจซ้ำอีกรอบเสมอ)
  function validate(): string {
    if (!employeeId || !idCard) return 'กรุณากรอกรหัสพนักงานและเลขบัตรประชาชน'
    if (!CODE_RE.test(employeeId)) return 'รหัสพนักงานต้องเป็นตัวอักษรอังกฤษ 3 ตัว ตามด้วยตัวเลข 4 ตัว เช่น SDO1234'
    if (idCard.length !== 13) return 'เลขบัตรประชาชนต้องมี 13 หลัก'
    return ''
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const invalid = validate()
    setError(invalid)
    if (invalid) {
      showError('กรอกข้อมูลไม่ครบ', invalid)
      return
    }

    setLoading(true)
    showLoading('กำลังเข้าสู่ระบบ', 'ตรวจสอบข้อมูลพนักงาน')
    let res: Awaited<ReturnType<typeof login>>
    try {
      res = await login({ code: employeeId, idCard, remember })
    } catch {
      res = { ok: false, error: 'ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง' }
    }

    if (!res.ok) {
      setLoading(false)
      setError(res.error)
      showError('เข้าสู่ระบบไม่สำเร็จ', res.error)
      return
    }

    // จดจำฉัน: เก็บรหัสพนักงานไว้เติมให้ + บันทึกรหัสผ่านลงตัวจัดการรหัสผ่านของเบราว์เซอร์
    // ไม่ติ๊ก: ลบรหัสที่จำไว้ และบอกเบราว์เซอร์ไม่ให้เติมให้อัตโนมัติ
    try {
      if (remember) localStorage.setItem(REMEMBER_KEY, employeeId)
      else localStorage.removeItem(REMEMBER_KEY)
    } catch { /* ไม่เป็นไร */ }
    if (remember) await saveToBrowser(employeeId, idCard, res.name)
    else await navigator.credentials?.preventSilentAccess?.().catch(() => {})

    // loading ค้างไว้จนหน้า dashboard โหลดเสร็จแล้วปิดเอง
    showLoading(`ยินดีต้อนรับ ${res.name}`, 'กำลังโหลดภาพรวมยอดขาย')
    router.push('/dashboard')
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-[#BFE0FA] via-[#8FC5F2] to-[#5DA8EB] flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {/* ---------- พื้นหลังตกแต่ง: วงกลมลอยเป็นชั้นๆ ---------- */}
      <div className="pointer-events-none absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-white/25 blur-md" />
      <div className="pointer-events-none absolute -top-16 -right-16 w-[280px] h-[280px] rounded-full bg-[#3B82F6]/30 blur-sm" />

      <div className="pointer-events-none absolute -bottom-40 -left-24 w-[380px] h-[380px] rounded-full bg-[#1D4ED8]/20 blur-md" />
      <div className="pointer-events-none absolute -bottom-20 -left-10 w-[220px] h-[220px] rounded-full bg-white/20 blur-sm" />

      <div className="pointer-events-none absolute top-[10%] left-[8%] w-24 h-24 rounded-full bg-white/30 blur-[2px]" />
      <div className="pointer-events-none absolute top-[15%] right-[12%] w-16 h-16 rounded-full bg-[#60A5FA]/40 blur-[2px]" />
      <div className="pointer-events-none absolute bottom-[12%] right-[10%] w-28 h-28 rounded-full bg-white/25 blur-[2px]" />
      <div className="pointer-events-none absolute bottom-[18%] left-[14%] w-14 h-14 rounded-full bg-[#2563EB]/30 blur-[1px]" />
      <div className="pointer-events-none absolute top-[45%] right-[6%] w-10 h-10 rounded-full bg-white/40" />
      <div className="pointer-events-none absolute top-[55%] left-[6%] w-8 h-8 rounded-full bg-[#3B82F6]/40" />

      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-white/10 blur-3xl" />

      {/* ---------- การ์ด login แบบ split-panel ---------- */}
      <div className="relative z-10 w-full max-w-4xl bg-white rounded-[28px] shadow-2xl overflow-hidden flex flex-col md:flex-row md:h-[560px]">
        {/* ฝั่งซ้าย: hero คลื่นสีฟ้า */}
        <div className="relative shrink-0 h-[180px] md:h-auto md:w-[42%] bg-gradient-to-br from-[#173B8C] via-[#2563EB] to-[#3B9EE8] overflow-hidden flex flex-col justify-between p-6 sm:p-8 md:p-10">
          <div className="pointer-events-none absolute -top-10 -left-10 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-10 right-0 w-52 h-52 rounded-full bg-white/10 blur-3xl" />

          <div className="relative z-10">
            <p className="text-white/70 text-xs tracking-wide uppercase mb-1">
              R8M Group
            </p>
            <h1 className="text-white text-2xl md:text-3xl font-semibold leading-snug">
              ยินดีต้อนรับ
              <br className="hidden md:block" /> กลับเข้าระบบ
            </h1>
            <p className="hidden md:block text-white/70 text-sm mt-4 max-w-[220px] leading-relaxed">
              ตรวจสอบข้อมูล datawh ได้อย่างรวดเร็วและง่ายดาย เพียงกรอกข้อมูลพนักงานของคุณ
            </p>
          </div>

          <div className="relative z-10 hidden md:flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-white flex items-center justify-center overflow-hidden shrink-0">
              <Image src="/logo.png" alt="R8M Group" width={32} height={32} />
            </div>
            <p className="text-white/60 text-xs">Rsm Group</p>
          </div>

          {/* ขอบคลื่นคั่นระหว่าง 2 ฝั่ง (desktop) */}
          <svg
            className="hidden md:block absolute top-0 right-0 h-full w-10 translate-x-[1px]"
            viewBox="0 0 40 800"
            preserveAspectRatio="none"
          >
            <path
              d="M40,0
                 C15,60 15,100 40,160
                 C15,220 15,260 40,320
                 C15,380 15,420 40,480
                 C15,540 15,580 40,640
                 C15,700 15,740 40,800
                 L40,0 Z"
              fill="white"
            />
          </svg>

          {/* ขอบคลื่นด้านล่าง (mobile) */}
          <svg
            className="md:hidden absolute bottom-0 left-0 w-full h-6 translate-y-[1px]"
            viewBox="0 0 400 24"
            preserveAspectRatio="none"
          >
            <path
              d="M0,24 C50,0 100,0 150,14 C200,26 250,26 300,10 C350,-2 380,4 400,10 L400,24 Z"
              fill="white"
            />
          </svg>
        </div>

        {/* ฝั่งขวา: ฟอร์ม sign in */}
        <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 py-10">
          <div className="w-full max-w-xs mx-auto md:mx-0">
            <h2 className="text-xl font-semibold text-gray-800 mb-1">เข้าสู่ระบบ</h2>
            <p className="text-sm text-gray-400 mb-8">กรอกข้อมูลพนักงานเพื่อเข้าใช้งาน</p>

            {/* name / autoComplete ตามมาตรฐาน → เบราว์เซอร์เสนอ "บันทึกรหัสผ่าน" ให้เอง */}
            <form onSubmit={handleLogin} className="space-y-4" noValidate>
              <div>
                <label htmlFor="username" className="block text-xs font-medium text-gray-500 mb-1.5">
                  รหัสพนักงาน
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={employeeId}
                  // พิมพ์ได้เฉพาะ A-Z / 0-9 แปลงเป็นตัวพิมพ์ใหญ่ให้ และยาวไม่เกิน 7 ตัว (เช่น SDO1234)
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7))}
                  placeholder="เช่น SDO1234"
                  maxLength={7}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 tracking-wider
                             focus:ring-2 focus:ring-[#3B9EE8] focus:border-transparent
                             text-gray-800 placeholder-gray-300 placeholder:tracking-normal transition"
                />
              </div>

              <div>
                <label htmlFor="password" className="flex justify-between text-xs font-medium text-gray-500 mb-1.5">
                  <span>เลขบัตรประชาชน</span>
                  <span className={idCard.length === 13 ? 'text-emerald-600' : 'text-gray-300'}>{idCard.length}/13</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  inputMode="numeric"
                  value={idCard}
                  // พิมพ์ได้เฉพาะตัวเลข สูงสุด 13 หลัก
                  onChange={(e) => setIdCard(e.target.value.replace(/\D/g, '').slice(0, 13))}
                  placeholder="กรอกเลข 13 หลัก"
                  maxLength={13}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200
                             focus:ring-2 focus:ring-[#3B9EE8] focus:border-transparent
                             text-gray-800 placeholder-gray-300 transition"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded accent-[#2563EB]"
                />
                บันทึกรหัสผ่าน
              </label>

              {error && (
                <p className="text-sm text-red-500 text-center bg-red-50 py-2 px-4 rounded-lg">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-[#3B9EE8] hover:bg-[#2b8fd8]
                           text-white font-semibold text-sm transition
                           disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              >
                {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
              </button>
            </form>

            <p className="text-center text-xs text-gray-300 mt-8">
              © 2026 R8M Group. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}