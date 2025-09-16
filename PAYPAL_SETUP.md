PayPal Integration Setup
========================

1. Sandbox Account
   - Create a PayPal developer account https://developer.paypal.com/
   - Create a REST App and obtain Client ID and Secret (Sandbox first).

2. Environment Variables (.env in project root and server .env)
   PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID
   PAYPAL_SECRET=YOUR_SANDBOX_SECRET
   PAYPAL_MODE=sandbox

   For production set PAYPAL_MODE=live with live credentials.

3. Vite Web Client
   - Add VITE_PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID to .env for the web frontend so the SDK loads.

4. Server Endpoints
   - POST /api/paypal/orders { total, currency }
   - POST /api/paypal/orders/:orderID/capture

5. Usage in React (Web)
   import { PayPalCheckout } from './components/PayPalCheckout';
   <PayPalCheckout total={orderTotal} currency="USD" onSuccess={(details)=>console.log(details)} />

6. Mobile (React Native)
   The PayPal JS SDK is web-focused. For React Native you typically:
     - Open a WebView hosting the PayPal button flow, OR
     - Use Braintree (PayPal owned) native SDKs for card entry, OR
     - Use PayPal's advanced card payments API server-to-server.

   Current implementation only adds web checkout button component. Mobile PaymentScreen can:
     - Call server to create order
     - Collect card details locally (NEVER send raw PAN to your server unless PCI compliant)
     - Prefer a provider like Stripe/Braintree for direct card entry.

7. Security Notes
   - Always verify capture status server-side before fulfilling order.
   - Store transaction id, payer id, amount, currency.
   - Implement webhook (/webhook/paypal) for sale completed / disputes if needed.

8. Next Steps
   - Add persistence linking PayPal capture to internal Order model.
   - Add refund endpoint using /v2/payments/captures/:id/refund.
   - Implement webhook validation using transmission id and signature.

9. Testing
   - Use sandbox test buyer accounts with sufficient balance / funding.
   - Simulate capture failures by altering amount or currency.
