import { LoadingOverlay } from '@/app/components/Loading';

// ระหว่างรอข้อมูล (ยอดขาย + Target จาก Google Sheet) แสดง loading ของ SweetAlert2
export default function DashboardLoading() {
  return (
    <>
      <style>{`body { background: #F3F6FB; }`}</style>
      <div aria-busy="true" style={{ minHeight: '100vh' }} />
      <LoadingOverlay />
    </>
  );
}
