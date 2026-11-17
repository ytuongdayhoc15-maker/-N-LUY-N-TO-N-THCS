import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileText, HardDrive, Shield } from 'lucide-react';
import { apiRequest } from '../lib/api';

export const GuideAndDownload: React.FC = () => {
  const [health, setHealth] = useState<{ engine: string; questionsCount: number; zipAvailable: boolean } | null>(null);

  useEffect(() => {
    apiRequest<any>('/api/health').then(setHealth).catch(() => {});
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
              Tải gói chạy Windows & Hướng dẫn sử dụng
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Giải nén 1 lần, nhấp đúp <code className="font-mono font-semibold">CHAY-WINDOWS.bat</code> để dùng ngoại tuyến trên Windows 10/11 mà không cần cài npm.
            </p>
          </div>
          {health?.zipAvailable && (
            <a
              href="/api/download-zip"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              <Download className="h-4 w-4" />
              <span>Tải ON-LUYEN-TOAN-THCS.zip</span>
            </a>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <HardDrive className="h-4 w-4 text-blue-600" />
              <span>Cơ sở dữ liệu bền vững</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Động cơ hiện tại: <strong className="font-mono">{health?.engine || 'sqlite / json-atomic'}</strong> · Ngân hàng khởi tạo: <strong className="font-mono">{health?.questionsCount ?? 44}</strong> câu hỏi đã kiểm chứng.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <Shield className="h-4 w-4 text-emerald-600" />
              <span>An toàn dữ liệu học sinh</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Mật khẩu băm scrypt, kiểm tra phân quyền máy chủ, chống CSRF/XSS/SQLi, chỉ lưu Mã HS, Họ tên và Lớp (không thu thập thông tin cá nhân nhạy cảm).
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-slate-100">
              <FileText className="h-4 w-4 text-violet-600" />
              <span>Chế độ phòng máy LAN</span>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              Mặc định chỉ mở cục bộ tại <code className="font-mono">127.0.0.1:3000</code>. Giáo viên có thể chọn mục [2] trong <code className="font-mono">CHAY-WINDOWS.bat</code> để học sinh làm bài qua mạng LAN nội bộ.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Hướng dẫn cài đặt nhanh trên Windows 10/11
          </h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700 dark:text-slate-300">
            <li>Cài đặt <strong>Node.js LTS</strong> (khuyên dùng v20 hoặc v22) tại <span className="font-mono">https://nodejs.org/</span>.</li>
            <li>Giải nén file <span className="font-mono">ON-LUYEN-TOAN-THCS.zip</span> vào một thư mục cố định.</li>
            <li>Nhấp đúp <span className="font-mono">CHAY-WINDOWS.bat</span>. Hệ thống tự kiểm tra Node.js, khởi động máy chủ và mở trình duyệt web.</li>
            <li>Không cần chạy <span className="font-mono">npm install</span> và không cần Internet khi luyện tập, thi thử hoặc chơi trò chơi.</li>
            <li>Để dừng máy chủ, quay lại cửa sổ dòng lệnh màu đen và nhấn <span className="font-mono">Ctrl + C</span>.</li>
          </ol>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-50">
            Tài khoản mẫu để kiểm thử phân quyền
          </h3>
          <div className="mt-3 space-y-2.5 text-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Quản trị viên (Admin)</div>
                <div className="font-mono text-xs text-slate-500">admin / Admin@2026</div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Giáo viên Toán</div>
                <div className="font-mono text-xs text-slate-500">gv_toan / GiaoVien@2026</div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 dark:border-slate-800 dark:bg-slate-800/60">
              <div>
                <div className="font-semibold text-slate-900 dark:text-slate-100">Học sinh (Lớp 6, 8, 9)</div>
                <div className="font-mono text-xs text-slate-500">hs_an, hs_binh, hs_chi / HocSinh@2026</div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-violet-600" />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Lưu ý: Có thể đổi mật khẩu trực tiếp sau khi đăng nhập ở biểu tượng tài khoản.
          </p>
        </div>
      </div>
    </div>
  );
};
