import axios from "axios"
import crypto from "crypto"
import prisma from "../db"

/**
 * Dispatches an event to all active webhook endpoints subscribed to it.
 * 
 * @param eventType Set to exactly match the documented webhook event strings (e.g., "ticket.created")
 * @param payload The JSON object to send
 * @param tenantId The tenant dispatching the event (defaults to "default" for now)
 */
export const dispatchWebhookEvent = async (eventType: string, payload: any, tenantId: string = "default") => {
  try {
    // Find all active endpoints listening to this event or a wildcard "*"
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        tenantId,
        isActive: true,
      }
    })

    const matchingEndpoints = endpoints.filter(ep =>
      ep.events.includes(eventType) || ep.events.includes("*")
    )

    if (matchingEndpoints.length === 0) return

    const eventId = `evt_${crypto.randomUUID().replace(/-/g, "")}`
    const timestamp = Math.floor(Date.now() / 1000).toString()

    const body = JSON.stringify({
      id: eventId,
      type: eventType,
      created_at: timestamp,
      data: payload
    })

    // Dispatch to all matching endpoints concurrently
    await Promise.allSettled(
      matchingEndpoints.map(async (endpoint) => {
        try {
          // Generate HMAC signature using the endpoint's secret
          const signature = crypto
            .createHmac("sha256", endpoint.secret)
            .update(`${timestamp}.${body}`)
            .digest("hex")

          await axios.post(endpoint.url, body, {
            headers: {
              "Content-Type": "application/json",
              "GMS-Signature": `t=${timestamp},v1=${signature}`,
              "GMS-Event-Id": eventId,
              "User-Agent": "GMS-Webhook-System/1.0"
            },
            timeout: 5000 // 5 seconds timeout
          })

          // You could optionally log successful deliveries here

        } catch (deliveryError: any) {
          // You could log failures for auto-disabling endpoints after N failures
          console.error(`Webhook Delivery Failed -> [${eventType}] to ${endpoint.url}:`, deliveryError.message)
        }
      })
    )

  } catch (error) {
    console.error("Webhook Dispatch error:", error)
  }
}
