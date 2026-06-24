const bcrypt = require('bcryptjs');
async function test() {
  const hash = '$2b$10$rV/jSfQXxZnVSK9dcYg4T.p4JOq0OnNxmypDw.VlkXYlYv/NVE.Ry';
  const match = await bcrypt.compare('123456', hash);
  console.log('Is 123456?', match);
}
test();
