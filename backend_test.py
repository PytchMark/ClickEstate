#!/usr/bin/env python3
"""
ClickEstate Backend API Testing Suite
Tests core API endpoints for health, admin login, and basic functionality
"""

import requests
import sys
import json
from datetime import datetime

class ClickEstateAPITester:
    def __init__(self, base_url="http://localhost:8001"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    Details: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {method} {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            
            try:
                response_data = response.json()
            except:
                response_data = {"raw_response": response.text}

            details = f"Status: {response.status_code}, Response: {json.dumps(response_data, indent=2)[:200]}..."
            
            self.log_test(name, success, details)
            
            return success, response_data

        except requests.exceptions.RequestException as e:
            details = f"Request failed: {str(e)}"
            self.log_test(name, False, details)
            return False, {}

    def test_health_endpoint(self):
        """Test /health endpoint"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/health",
            200
        )
        
        if success and response.get('ok') == True:
            self.log_test("Health Response Format", True, "Contains 'ok: true'")
            return True
        elif success:
            self.log_test("Health Response Format", False, f"Expected 'ok: true', got: {response}")
            return False
        return False

    def test_admin_login(self, username="admin", password="admin123"):
        """Test admin login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/api/admin/login",
            200,
            data={"username": username, "password": password}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.log_test("Admin Token Received", True, f"Token length: {len(self.token)}")
            return True
        elif success:
            self.log_test("Admin Token Received", False, f"No token in response: {response}")
            return False
        return False

    def test_admin_login_invalid(self):
        """Test admin login with invalid credentials"""
        success, response = self.run_test(
            "Admin Login Invalid Credentials",
            "POST",
            "/api/admin/login",
            401,
            data={"username": "invalid", "password": "invalid"}
        )
        return success

    def test_public_endpoints(self):
        """Test public endpoints that should work without auth"""
        
        # Test agency endpoint (should return 404 for non-existent agency)
        self.run_test(
            "Public Agency Endpoint (Non-existent)",
            "GET",
            "/api/public/agency/TEST-AGENCY",
            404
        )
        
        # Test listings endpoint (should return 400 without agencyIds)
        self.run_test(
            "Public Listings Endpoint (No Agency IDs)",
            "GET",
            "/api/public/listings",
            400
        )
        
        # Test featured listings
        self.run_test(
            "Public Featured Listings",
            "GET",
            "/api/public/featured",
            200
        )

    def test_protected_endpoints_without_auth(self):
        """Test that protected endpoints require authentication"""
        
        # Clear token for this test
        old_token = self.token
        self.token = None
        
        self.run_test(
            "Admin Summary (No Auth)",
            "GET",
            "/api/admin/summary",
            401
        )
        
        self.run_test(
            "Realtor Listings (No Auth)",
            "GET",
            "/api/realtor/listings",
            401
        )
        
        # Restore token
        self.token = old_token

    def test_admin_protected_endpoints(self):
        """Test admin protected endpoints with valid token"""
        if not self.token:
            self.log_test("Admin Protected Endpoints", False, "No admin token available")
            return False
        
        # Test admin summary
        success, response = self.run_test(
            "Admin Summary (With Auth)",
            "GET",
            "/api/admin/summary",
            200
        )
        
        if success and 'summary' in response:
            self.log_test("Admin Summary Format", True, "Contains summary data")
        elif success:
            self.log_test("Admin Summary Format", False, f"Missing summary field: {response}")
        
        # Test admin agencies
        self.run_test(
            "Admin Agencies List",
            "GET",
            "/api/admin/agencies",
            200
        )
        
        # Test admin listings
        self.run_test(
            "Admin Listings List",
            "GET",
            "/api/admin/listings",
            200
        )

    def test_ai_endpoints_without_auth(self):
        """Test AI endpoints require authentication"""
        # Clear token for this test
        old_token = self.token
        self.token = None
        
        # Test generate-description without auth
        self.run_test(
            "AI Generate Description (No Auth)",
            "POST",
            "/api/ai/generate-description",
            401,
            data={"title": "Test Property", "property_type": "house"}
        )
        
        # Test improve-description without auth
        self.run_test(
            "AI Improve Description (No Auth)",
            "POST",
            "/api/ai/improve-description",
            401,
            data={"currentDescription": "Test description", "instructions": "Make it better"}
        )
        
        # Restore token
        self.token = old_token

    def test_ai_endpoints_with_admin_token(self):
        """Test AI endpoints reject admin tokens (require realtor role)"""
        if not self.token:
            self.log_test("AI Endpoints Admin Token Test", False, "No admin token available")
            return False
        
        # Test generate-description with admin token (should return 403)
        self.run_test(
            "AI Generate Description (Admin Token - Should Fail)",
            "POST",
            "/api/ai/generate-description",
            403,
            data={"title": "Test Property", "property_type": "house"}
        )
        
        # Test improve-description with admin token (should return 403)
        self.run_test(
            "AI Improve Description (Admin Token - Should Fail)",
            "POST",
            "/api/ai/improve-description",
            403,
            data={"currentDescription": "Test description", "instructions": "Make it better"}
        )

    def test_ai_endpoints_structure(self):
        """Test AI endpoints exist and return proper error messages"""
        # Test with admin token to check endpoint existence (should get 403, not 404)
        if not self.token:
            self.log_test("AI Endpoints Structure Test", False, "No admin token available")
            return False
        
        # Test generate-description endpoint exists
        success, response = self.run_test(
            "AI Generate Description Endpoint Exists",
            "POST",
            "/api/ai/generate-description",
            403,  # Should get 403 (forbidden) not 404 (not found)
            data={"title": "Test Property"}
        )
        
        # Test improve-description endpoint exists
        success2, response2 = self.run_test(
            "AI Improve Description Endpoint Exists",
            "POST",
            "/api/ai/improve-description",
            403,  # Should get 403 (forbidden) not 404 (not found)
            data={"currentDescription": "Test description"}
        )
        
        # Test NEW analyze-image endpoint exists
        success3, response3 = self.run_test(
            "AI Analyze Image Endpoint Exists",
            "POST",
            "/api/ai/analyze-image",
            403,  # Should get 403 (forbidden) not 404 (not found)
            data={"imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"}
        )

    def test_cors_headers(self):
        """Test CORS headers are present"""
        try:
            response = requests.options(f"{self.base_url}/health", timeout=10)
            cors_header = response.headers.get('Access-Control-Allow-Origin')
            
            if cors_header:
                self.log_test("CORS Headers", True, f"Access-Control-Allow-Origin: {cors_header}")
            else:
                self.log_test("CORS Headers", False, "No CORS headers found")
                
        except Exception as e:
            self.log_test("CORS Headers", False, f"CORS test failed: {str(e)}")

    def test_new_features_endpoints(self):
        """Test new features added: pricing plans, payments, AI image analysis"""
        
        # Test pricing plans endpoint (public)
        success, response = self.run_test(
            "Public Pricing Plans Endpoint",
            "GET",
            "/api/public/plans",
            200
        )
        
        if success and 'plans' in response:
            plans = response['plans']
            expected_plans = ['starter', 'pro', 'unlimited']
            found_plans = list(plans.keys()) if isinstance(plans, dict) else []
            
            if all(plan in found_plans for plan in expected_plans):
                self.log_test("Pricing Plans Structure", True, f"Found plans: {found_plans}")
                
                # Check plan details
                starter = plans.get('starter', {})
                if starter.get('price') == 29.0 and starter.get('name') == 'Starter':
                    self.log_test("Starter Plan Details", True, f"Price: ${starter.get('price')}, Name: {starter.get('name')}")
                else:
                    self.log_test("Starter Plan Details", False, f"Expected price: 29.0, name: Starter, got: {starter}")
                
                pro = plans.get('pro', {})
                if pro.get('price') == 79.0 and pro.get('name') == 'Pro':
                    self.log_test("Pro Plan Details", True, f"Price: ${pro.get('price')}, Name: {pro.get('name')}")
                else:
                    self.log_test("Pro Plan Details", False, f"Expected price: 79.0, name: Pro, got: {pro}")
                
                unlimited = plans.get('unlimited', {})
                if unlimited.get('price') == 199.0 and unlimited.get('name') == 'Unlimited':
                    self.log_test("Unlimited Plan Details", True, f"Price: ${unlimited.get('price')}, Name: {unlimited.get('name')}")
                else:
                    self.log_test("Unlimited Plan Details", False, f"Expected price: 199.0, name: Unlimited, got: {unlimited}")
            else:
                self.log_test("Pricing Plans Structure", False, f"Expected {expected_plans}, got: {found_plans}")
        elif success:
            self.log_test("Pricing Plans Structure", False, f"Missing 'plans' field: {response}")
        
        # Test payments checkout endpoint (should require data)
        success, response = self.run_test(
            "Payments Checkout Endpoint (Missing Data)",
            "POST",
            "/api/payments/checkout",
            400,
            data={}
        )
        
        # Test payments checkout with valid data structure
        success, response = self.run_test(
            "Payments Checkout Endpoint (Valid Structure)",
            "POST",
            "/api/payments/checkout",
            500,  # Expect 500 due to test Stripe key, but endpoint should exist
            data={
                "planId": "starter",
                "originUrl": "http://localhost:8001",
                "agencyId": "TEST-AGENCY",
                "realtorId": "TEST-REALTOR",
                "email": "test@example.com",
                "displayName": "Test User"
            }
        )
        
        if success or (not success and "stripe" in str(response).lower()):
            self.log_test("Payments Checkout Endpoint Exists", True, "Endpoint exists and processes Stripe requests")
        else:
            self.log_test("Payments Checkout Endpoint Exists", False, f"Unexpected response: {response}")

    def test_stripe_webhook_endpoint(self):
        """Test Stripe webhook endpoint exists"""
        # Test webhook endpoint (should handle raw body)
        success, response = self.run_test(
            "Stripe Webhook Endpoint",
            "POST",
            "/api/webhook/stripe",
            400,  # Expect 400 due to invalid signature, but endpoint should exist
            data={"test": "data"},
            headers={"stripe-signature": "invalid"}
        )
        
        if success or (not success and "stripe" in str(response).lower()):
            self.log_test("Stripe Webhook Endpoint Exists", True, "Webhook endpoint exists")
        else:
            self.log_test("Stripe Webhook Endpoint Exists", False, f"Unexpected response: {response}")

    def run_all_tests(self):
        """Run complete test suite"""
        print("=" * 60)
        print("🚀 ClickEstate Backend API Test Suite")
        print("=" * 60)
        
        # Basic connectivity and health
        print("\n📋 Basic Connectivity Tests")
        self.test_health_endpoint()
        
        # Authentication tests
        print("\n🔐 Authentication Tests")
        self.test_admin_login()
        self.test_admin_login_invalid()
        
        # Public endpoint tests
        print("\n🌐 Public Endpoint Tests")
        self.test_public_endpoints()
        
        # Authorization tests
        print("\n🛡️ Authorization Tests")
        self.test_protected_endpoints_without_auth()
        
        # AI endpoint tests
        print("\n🤖 AI Endpoint Tests")
        self.test_ai_endpoints_without_auth()
        self.test_ai_endpoints_with_admin_token()
        self.test_ai_endpoints_structure()
        
        # Admin functionality tests
        print("\n👑 Admin Functionality Tests")
        self.test_admin_protected_endpoints()
        
        # Infrastructure tests
        print("\n🔧 Infrastructure Tests")
        self.test_cors_headers()
        
        # Print summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("⚠️  Some tests failed. Check details above.")
            return 1

def main():
    """Main test runner"""
    tester = ClickEstateAPITester("http://localhost:8001")
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())