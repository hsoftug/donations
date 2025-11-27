
import requests
import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)


class PesapalClient:
    """
    Complete Pesapal API client for authentication, IPN registration, and payments.
    Handles token management, caching, and error handling.
    """

    def __init__(self, sandbox=True):
        # Toggle sandbox or production
        if sandbox:
            self.base_url = "https://cybqa.pesapal.com/pesapalv3/api"
        else:
            self.base_url = "https://www.pesapal.com/pesapalv3/api"

        # TODO: Move these to environment variables or Django settings
        self.consumer_key = "qkio1BGGYAXTu2JOfm7XSXNruoZsrqEW"
        self.consumer_secret = "osGQ364R49cXKeOYSpaOnT++rHs="

        # Cache keys
        self.token_cache_key = "pesapal_access_token"
        self.ipn_cache_key = "pesapal_ipn_id"

    # --------------------- Token Management --------------------- #
    def get_access_token(self):
        """
        Get access token from cache or request new one.
        Tokens are valid for 5 minutes.
        """
        cached_token = cache.get(self.token_cache_key)
        if cached_token:
            logger.info("Using cached Pesapal access token")
            return cached_token

        logger.info("Requesting new Pesapal access token")
        url = f"{self.base_url}/Auth/RequestToken"
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        payload = {"consumer_key": self.consumer_key, "consumer_secret": self.consumer_secret}

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            token = data.get("token")
            if not token:
                raise ValueError("No token in response")
            cache.set(self.token_cache_key, token, timeout=240)  # refresh early
            logger.info("Successfully obtained and cached access token")
            return token
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get access token: {str(e)}")
            raise Exception(f"Pesapal authentication failed: {str(e)}")

    # --------------------- IPN Registration --------------------- #
    def register_ipn(self, ipn_url, notification_type="POST"):
        """
        Register IPN URL with Pesapal.
        Returns the IPN ID needed for payment requests.
        """
        cached_ipn_id = cache.get(self.ipn_cache_key)
        if cached_ipn_id:
            logger.info(f"Using cached IPN ID: {cached_ipn_id}")
            return cached_ipn_id

        logger.info(f"Registering IPN URL: {ipn_url}")
        token = self.get_access_token()
        url = f"{self.base_url}/URLSetup/RegisterIPN"
        headers = {"Accept": "application/json", "Content-Type": "application/json", "Authorization": f"Bearer {token}"}
        payload = {"url": ipn_url, "ipn_notification_type": notification_type}

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            ipn_id = data.get("ipn_id")
            if not ipn_id:
                raise ValueError("No IPN ID in response")
            cache.set(self.ipn_cache_key, ipn_id, timeout=86400)  # 24 hours
            logger.info(f"Successfully registered IPN. ID: {ipn_id}")
            return ipn_id
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to register IPN: {str(e)}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            raise Exception(f"IPN registration failed: {str(e)}")

    # --------------------- Submit Order --------------------- #
    def submit_order(self, order_data):
        """
        Submit order to Pesapal and get payment redirect URL.
        order_data should contain:
        - id: unique order ID
        - currency: e.g., "UGX", "KES", "USD"
        - amount: decimal amount
        - description: order description
        - callback_url: redirect after payment
        - notification_id: IPN ID from register_ipn()
        - billing_address: dict with email, phone_number, country_code, first_name, last_name
        """
        logger.info(f"Submitting order: {order_data.get('id')}")

        # Ensure notification_id exists
        if not order_data.get("notification_id") and order_data.get("callback_url"):
            logger.info("No IPN ID provided, registering automatically")
            order_data["notification_id"] = self.register_ipn(order_data.get("callback_url"))

        token = self.get_access_token()
        url = f"{self.base_url}/Transactions/SubmitOrderRequest"
        headers = {"Accept": "application/json", "Content-Type": "application/json", "Authorization": f"Bearer {token}"}

        try:
            response = requests.post(url, json=order_data, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()

            # Support multiple redirect URL keys
            redirect_url = data.get("redirect_url") or data.get("checkout_url") or data.get("payment_url")
            order_tracking_id = data.get("order_tracking_id") or data.get("orderTrackingId")
            merchant_reference = data.get("merchant_reference") or data.get("merchantReference")
            status = data.get("status")

            if not redirect_url:
                logger.error("Pesapal response missing redirect URL: %s", data)
                raise ValueError("No redirect URL in response")

            logger.info(f"Order submitted successfully. Tracking ID: {order_tracking_id}")
            return {
                "redirect_url": redirect_url,
                "order_tracking_id": order_tracking_id,
                "merchant_reference": merchant_reference,
                "status": status
            }
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to submit order: {str(e)}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            raise Exception(f"Order submission failed: {str(e)}")

    # --------------------- Transaction Status --------------------- #
    def get_transaction_status(self, order_tracking_id):
        """
        Check the status of a transaction using the order tracking ID.
        """
        logger.info(f"Checking transaction status: {order_tracking_id}")
        token = self.get_access_token()
        url = f"{self.base_url}/Transactions/GetTransactionStatus"
        headers = {"Accept": "application/json", "Content-Type": "application/json", "Authorization": f"Bearer {token}"}
        params = {"orderTrackingId": order_tracking_id}

        try:
            response = requests.get(url, params=params, headers=headers, timeout=30)
            response.raise_for_status()
            data = response.json()
            logger.info(f"Transaction status: {data.get('payment_status_description')}")
            return data
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get transaction status: {str(e)}")
            if hasattr(e.response, 'text'):
                logger.error(f"Response: {e.response.text}")
            raise Exception(f"Status check failed: {str(e)}")
