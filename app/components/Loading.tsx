'use client';

// Loading / แจ้งเตือนทั้งระบบใช้ SweetAlert2
import { useEffect, useTransition, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Swal from 'sweetalert2';

const BASE = {
  customClass: { popup: 'swal-genesis' },
  buttonsStyling: false,
} as const;

export function showLoading(title = 'กำลังโหลดข้อมูล', text = 'ดึงยอดขายและ Target ล่าสุด') {
  if (Swal.isVisible() && Swal.isLoading()) return;
  Swal.fire({
    ...BASE,
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });
}

export function closeLoading() {
  if (Swal.isVisible() && Swal.isLoading()) Swal.close();
}

export function showError(title: string, text: string) {
  Swal.fire({ ...BASE, icon: 'error', title, text, confirmButtonText: 'ตกลง', customClass: { ...BASE.customClass, confirmButton: 'swal-btn' } });
}

export function showToast(title: string) {
  Swal.fire({ ...BASE, toast: true, position: 'top-end', icon: 'success', title, showConfirmButton: false, timer: 2200, timerProgressBar: true });
}

// ปุ่มออกจากระบบ: ถามยืนยันก่อน แล้วเรียก server action (ลบ cookie + กลับหน้า login)
export function LogoutButton({ action, className, children, title = 'ออกจากระบบ' }: {
  action: () => Promise<void>; className?: string; children: ReactNode; title?: string;
}) {
  const [, startTransition] = useTransition();
  async function onClick() {
    const res = await Swal.fire({
      ...BASE,
      icon: 'question',
      title: 'ออกจากระบบ?',
      text: 'ครั้งหน้าต้องเข้าสู่ระบบใหม่ด้วยรหัสพนักงานและเลขบัตรประชาชน',
      showCancelButton: true,
      confirmButtonText: 'ออกจากระบบ',
      cancelButtonText: 'ยกเลิก',
      reverseButtons: true,
      focusCancel: true,
      customClass: { ...BASE.customClass, confirmButton: 'swal-btn', cancelButton: 'swal-btn swal-btn-ghost', actions: 'swal-actions' },
    });
    if (!res.isConfirmed) return;
    showLoading('กำลังออกจากระบบ', '');
    startTransition(() => action());
  }
  return <button type="button" className={className} onClick={onClick} title={title} aria-label={title}>{children}</button>;
}

// แสดง loading ตลอดที่ component นี้อยู่บนจอ (ใช้ใน loading.tsx)
export function LoadingOverlay() {
  useEffect(() => {
    showLoading();
    return () => closeLoading();
  }, []);
  return null;
}

// หน้าโหลดเสร็จแล้ว → ปิด loading ที่เปิดค้างมาจากหน้าก่อน (เช่นจากหน้า login)
export function LoadingDone({ error }: { error?: string | null }) {
  useEffect(() => {
    closeLoading();
    if (error) showError('โหลดข้อมูลไม่สำเร็จ', error);
  }, [error]);
  return null;
}

// ฟอร์ม filter: ค้นหาแบบไม่ reload ทั้งหน้า + แสดง loading จนข้อมูลชุดใหม่มาถึง
export function FilterForm({ id, className, children }: { id: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!isPending) closeLoading();
  }, [isPending]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const qs = new URLSearchParams();
    // FormData รวม input ที่ผูกด้วย form="..." นอกฟอร์มด้วย (เช่นปุ่มเลือกมุมมอง)
    for (const [k, v] of new FormData(e.currentTarget)) qs.set(k, String(v));
    showLoading();
    startTransition(() => router.push(`?${qs.toString()}`));
  }

  return <form id={id} className={className} onSubmit={onSubmit}>{children}</form>;
}
