/**
 * Expo config plugin: expo-notifications가 추가하는 aps-environment entitlement 제거
 * 무료 Apple 개인 계정은 Push Notifications를 지원하지 않으므로
 * prebuild 후 자동으로 이 키를 삭제합니다.
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withRemovePushEntitlement(config) {
  return withEntitlementsPlist(config, (config) => {
    delete config.modResults['aps-environment'];
    return config;
  });
};
