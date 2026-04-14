const fs = require('fs');
const path = require('path');

const entitlementsPath = path.join(__dirname, '../ios/Dotori/Dotori.entitlements');

const content = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
  </dict>
</plist>
`;

fs.writeFileSync(entitlementsPath, content);
console.log('✅ Dotori.entitlements fixed (aps-environment removed)');
