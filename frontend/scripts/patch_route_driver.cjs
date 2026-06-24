const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/pages/manager/RouteDriverManage.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update import
content = content.replace(
  "import { getRoutes } from '../../services/routeService';",
  "import { getRoutes, generateSchedule } from '../../services/routeService';"
);

// 2. Add generating state and handle function
const handleLogic = `
  const [generating, setGenerating] = useState(false);

  const handleGenerateSchedule = async () => {
    if (!selectedRoute) return;
    if (!window.confirm('Hành động này sẽ sinh lịch và phân công xoay vòng cho 60 ngày tiếp theo. Có thể mất một chút thời gian. Bạn có muốn tiếp tục?')) return;
    
    setGenerating(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await generateSchedule(selectedRoute.route_code);
      setSuccessMsg(res.data.message || 'Sinh lịch thành công!');
    } catch (err) {
      setError(err.response?.data?.message || 'Lỗi khi sinh lịch');
    } finally {
      setGenerating(false);
    }
  };
`;
content = content.replace(
  "const handleRemoveDriver = async () => {",
  handleLogic + "\n  const handleRemoveDriver = async () => {"
);

// 3. Add button in the UI
const buttonUi = `
                    <h2 className="font-semibold text-gray-800">
                      Danh sách Tài xế tuyến {selectedRoute.route_code} ({routeDrivers.length})
                    </h2>
                    <button
                      onClick={handleGenerateSchedule}
                      disabled={generating || routeDrivers.length === 0}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {generating ? 'Đang sinh lịch...' : 'Sinh lịch 2 tháng'}
                    </button>
`;
content = content.replace(
  "<h2 className=\"font-semibold text-gray-800\">\n                      Danh sách Tài xế tuyến {selectedRoute.route_code} ({routeDrivers.length})\n                    </h2>",
  buttonUi
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Patched RouteDriverManage.jsx');
