export function createUniqueId(senderId: string): string {
  // تنفيذ الشيفرة البرمجية لإنشاء رمز تعريفي فريد
  const uniqueId = Math.random().toString(36).substr(2, 9);

  // يمكنك تعديل هذه البيانات الإضافية حسب متطلبات البوت الخاص بك
  const userData = {
    userId: senderId,
    uniqueId,
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(userData);
}