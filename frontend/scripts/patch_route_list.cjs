const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/manager/RouteList.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update emptyForm
content = content.replace(
  "inbound_turnaround: 15\n};",
  "inbound_turnaround: 15,\n  travel_time_minutes: 80,\n  short_layover_minutes: 10,\n  long_layover_minutes: 15,\n  max_driving_minutes: 240,\n  standby_ratio: 0.15\n};"
);

// 2. Update openEdit to map new fields
content = content.replace(
  "inbound_turnaround: r.inbound_turnaround_time_minutes ?? 15,",
  "inbound_turnaround: r.inbound_turnaround_time_minutes ?? 15,\n      travel_time_minutes: r.travel_time_minutes ?? 80,\n      short_layover_minutes: r.short_layover_minutes ?? 10,\n      long_layover_minutes: r.long_layover_minutes ?? 15,\n      max_driving_minutes: r.max_driving_minutes ?? 240,\n      standby_ratio: r.standby_ratio ?? 0.15,"
);

// 3. Add calculation logic before return statement of the component
const calcLogic = `
  const rtt = Number(form.outbound_travel) + Number(form.outbound_turnaround) + Number(form.inbound_travel) + Number(form.inbound_turnaround);
  const editingSuggestedBuses = (Number(form.headway_minutes) > 0 && rtt > 0) ? Math.ceil(rtt / Number(form.headway_minutes)) : null;

  const operatingBuses = Number(form.confirmed_operating_buses) || 0;
  const mainShifts = operatingBuses * 2;
  const standbyCount = Math.ceil(mainShifts * (Number(form.standby_ratio) || 0));
  const dailyDrivers = mainShifts + standbyCount;
  const weeklyDrivers = Math.ceil(dailyDrivers * 7 / 6);
`;

content = content.replace(
  "const rtt = Number(form.outbound_travel) + Number(form.outbound_turnaround) + Number(form.inbound_travel) + Number(form.inbound_turnaround);\n  const editingSuggestedBuses = (Number(form.headway_minutes) > 0 && rtt > 0) ? Math.ceil(rtt / Number(form.headway_minutes)) : null;",
  calcLogic
);

// 4. Add the UI for new fields in the modal form
const uiFields = `
          {/* Scheduling Parameters */}
          <div className="grid grid-cols-2 gap-4 mt-6 border-t pt-4">
            <h4 className="col-span-2 text-sm font-semibold text-gray-700">Tham số lập lịch nâng cao</h4>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian chạy (phút)</label>
              <input type="number" value={form.travel_time_minutes} onChange={e => setForm({...form, travel_time_minutes: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nghỉ ngắn tại bến (phút)</label>
              <input type="number" value={form.short_layover_minutes} onChange={e => setForm({...form, short_layover_minutes: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nghỉ dài / Đổi ca (phút)</label>
              <input type="number" value={form.long_layover_minutes} onChange={e => setForm({...form, long_layover_minutes: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Giới hạn lái liên tục (phút)</label>
              <input type="number" value={form.max_driving_minutes} onChange={e => setForm({...form, max_driving_minutes: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tỉ lệ dự bị (Ví dụ: 0.15)</label>
              <input type="number" step="0.01" value={form.standby_ratio} onChange={e => setForm({...form, standby_ratio: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none" required />
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-blue-800">Nhu cầu Tài xế (Tính toán tự động)</h4>
              <p className="text-sm text-blue-600 mt-1">
                Số ca (Main): <span className="font-bold">{mainShifts}</span> | 
                Dự bị (Standby): <span className="font-bold">{standbyCount}</span>
              </p>
            </div>
            <div className="flex gap-4 text-center">
              <div className="bg-white px-4 py-2 rounded shadow-sm border border-blue-200">
                <div className="text-xs text-gray-500">Cần cho 1 Ngày</div>
                <div className="text-xl font-bold text-blue-700">{dailyDrivers}</div>
              </div>
              <div className="bg-white px-4 py-2 rounded shadow-sm border border-blue-200">
                <div className="text-xs text-gray-500">Cần cho 1 Tuần</div>
                <div className="text-xl font-bold text-blue-700">{weeklyDrivers}</div>
              </div>
            </div>
          </div>
`;

content = content.replace(
  "</div>\n              {editingSuggestedBuses && (",
  "</div>\n              {editingSuggestedBuses && (\n"
);
content = content.replace(
  "</div>\n            </div>\n          </div>\n\n          <div className=\"flex justify-end gap-3 mt-6\">",
  "</div>\n            </div>\n          </div>\n" + uiFields + "\n          <div className=\"flex justify-end gap-3 mt-6\">"
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched RouteList.jsx');
