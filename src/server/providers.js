























export class MockCommunicationProvider {
  async createMaskedChannel(taskId, residentId, volunteerId) {
    console.log(`[MockCommunicationProvider] Creating masked channel for task ${taskId}: resident ${residentId}, volunteer ${volunteerId}`);
    return {
      proxyPhone: `+1 (555) 019-${Math.floor(1000 + Math.random() * 9000)}`,
      residentProxyId: `res-proxy-${taskId}`,
      volunteerProxyId: `vol-proxy-${taskId}`
    };
  }

  async disableMaskedChannel(taskId) {
    console.log(`[MockCommunicationProvider] Disabling masked channel for task ${taskId}`);
  }
}

export class MockNotificationProvider {
  async sendNotification(userId, title, body) {
    console.log(`[MockNotificationProvider] Notification to ${userId}: [${title}] ${body}`);
  }
}

export const communicationProvider = new MockCommunicationProvider();
export const notificationProvider = new MockNotificationProvider();