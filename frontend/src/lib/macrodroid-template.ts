/**
 * MacroDroid Automation Template Generator for Zero-Friction ERP
 * Generates an importable .macro JSON structure configured with user's webhook endpoint & token.
 */

export interface MacroDroidTrigger {
  type: string;
  packageNames: string[];
  matchType?: string;
  [key: string]: unknown;
}

export interface MacroDroidAction {
  type: string;
  url: string;
  method: string;
  contentType: string;
  body: string;
  [key: string]: unknown;
}

export interface MacroDroidMacro {
  macroVersion: number;
  name: string;
  description: string;
  triggers: MacroDroidTrigger[];
  actions: MacroDroidAction[];
  [key: string]: unknown;
}

export function generateMacroDroidTemplate(
  webhookUrl: string,
  deviceLabel = "Ponsel Android"
): MacroDroidMacro {
  return {
    macroVersion: 2,
    name: "Zero-Friction ERP — Auto Catat Notifikasi",
    description:
      "Mendeteksi notifikasi pembayaran dari GoPay, OCTO Mobile, ShopeePay, dan blu lalu mengirimkannya ke ERP secara otomatis.",
    triggers: [
      {
        type: "NotificationTrigger",
        packageNames: [
          "com.gojek.app",
          "com.cimb.octo",
          "com.cimbniaga.octo",
          "com.shopeepay",
          "id.co.shopee",
          "com.blu.app",
          "id.co.bca.blu",
        ],
        matchType: "any",
      },
    ],
    actions: [
      {
        type: "HttpRequestAction",
        url: webhookUrl,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({
          device_id: deviceLabel,
          app_name: "{notification_app_name}",
          package_name: "{notification_package_name}",
          title: "{notification_title}",
          text: "{notification_text}",
          posted_at: "{system_time_iso}",
        }),
      },
    ],
  };
}

/** Saves the macro for this webhook URL as a .macro file the MacroDroid app can import. */
export function downloadMacroDroidTemplate(webhookUrl: string, deviceLabel = "Ponsel Android") {
  const json = JSON.stringify(generateMacroDroidTemplate(webhookUrl, deviceLabel), null, 2);
  const href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = href;
  link.download = "zero-friction-erp.macro";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(href);
}
