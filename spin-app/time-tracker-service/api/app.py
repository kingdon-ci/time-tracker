from spin_sdk.http import Handler, Request, Response, send
from spin_sdk import variables
import json
from datetime import datetime, date, timedelta
import calendar

class HttpHandler(Handler):
    async def handle_request(self, request: Request) -> Response:
        path = request.uri
        if path.startswith("/api/data"):
            return await self.get_current_month_data()
        elif path.startswith("/api/six"):
            return await self.get_six_day_data()
        elif path.startswith("/api/history"):
            return await self.get_history_summary()
        else:
            return Response(404, {"content-type": "text/plain"}, bytes("Not Found", "utf-8"))

    async def get_api_credentials(self):
        key = await variables.get("early_api_key")
        secret = await variables.get("early_api_secret")
        return key, secret

    async def authenticate(self):
        api_key, api_secret = await self.get_api_credentials()
        url = "https://api.early.app/api/v4/developer/sign-in"
        body = json.dumps({"apiKey": api_key, "apiSecret": api_secret})
        
        try:
            resp = await send(Request("POST", url, {"content-type": "application/json"}, bytes(body, "utf-8")))
            if resp.status != 200:
                return None
            
            data = json.loads(resp.body.decode("utf-8"))
            return data.get("token")
        except Exception as e:
            print(f"Auth error: {e}")
            return None

    async def fetch_entries(self, token, start_date, end_date):
        start_iso = start_date.strftime("%Y-%m-%dT00:00:00.000")
        end_iso = end_date.strftime("%Y-%m-%dT23:59:59.999")
        
        url = f"https://api.early.app/api/v4/time-entries/{start_iso}/{end_iso}"
        try:
            resp = await send(Request("GET", url, {"authorization": f"Bearer {token}"}, None))
            if resp.status != 200:
                return []
            
            data = json.loads(resp.body.decode("utf-8"))
            if isinstance(data, list):
                return data
            return data.get("timeEntries") or data.get("data") or []
        except Exception as e:
            print(f"Fetch error: {e}")
            return []

    def calculate_duration_seconds(self, duration_obj):
        if not isinstance(duration_obj, dict):
            return 0
        
        started_at = duration_obj.get('startedAt')
        stopped_at = duration_obj.get('stoppedAt')
        
        if not started_at or not stopped_at:
            return 0
            
        try:
            # Handle Z suffix for UTC
            start = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
            stop = datetime.fromisoformat(stopped_at.replace('Z', '+00:00'))
            delta = stop - start
            return int(delta.total_seconds())
        except Exception:
            return 0

    def format_duration(self, seconds):
        h = seconds // 3600
        m = (seconds % 3600) // 60
        s = seconds % 60
        return f"{h:02}:{m:02}:{s:02}"

    def count_weekdays(self, start, end):
        count = 0
        curr = start
        while curr < end:
            if curr.weekday() < 5:
                count += 1
            curr += timedelta(days=1)
        return count

    def is_nonbillable(self, entry):
        tags = entry.get("note", {}).get("tags", [])
        if tags:
            return any(t.get("label", "").lower() == "nonbillable" for t in tags)
        return False

    async def get_current_month_data(self):
        token = await self.authenticate()
        if not token:
            return Response(500, {"content-type": "application/json"}, bytes(json.dumps({"error": "Auth failed"}), "utf-8"))
            
        today = date.today()
        start_date = date(today.year, today.month, 1)
        _, last_day = calendar.monthrange(today.year, today.month)
        end_date = date(today.year, today.month, last_day)
        
        entries = await self.fetch_entries(token, start_date, end_date)
        
        processed_entries = []
        total_hours = 0.0
        for e in entries:
            duration_secs = self.calculate_duration_seconds(e.get("duration"))
            duration_hours = duration_secs / 3600.0
            nonbillable = self.is_nonbillable(e)
            
            processed_entries.append({
                "activity": e.get("activity", {}).get("name", ""),
                "duration": self.format_duration(duration_secs),
                "duration_hours": duration_hours,
                "note": e.get("note", {}).get("text", ""),
                "nonbillable": nonbillable
            })
            total_hours += duration_hours

        eff_end = today + timedelta(days=1)
        weekdays = self.count_weekdays(start_date, eff_end)
        expected_hours = weekdays * 8.0
        
        result = {
            "progress": {
                "total_hours": total_hours,
                "expected_hours": expected_hours,
                "percentage": (total_hours / expected_hours * 100) if expected_hours > 0 else 0,
                "hours_diff": total_hours - expected_hours,
                "status": "over" if total_hours >= expected_hours else "under",
                "weekdays": weekdays,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat()
            },
            "entries": processed_entries,
            "generated_at": datetime.now().isoformat()
        }
        
        return Response(200, {"content-type": "application/json"}, bytes(json.dumps(result), "utf-8"))

    async def get_six_day_data(self):
        token = await self.authenticate()
        if not token:
            return Response(500, {"content-type": "application/json"}, bytes(json.dumps({"error": "Auth failed"}), "utf-8"))
            
        today = date.today()
        start_date = today - timedelta(days=5)
        
        entries = await self.fetch_entries(token, start_date, today)
        processed_entries = []
        for e in entries:
            duration_secs = self.calculate_duration_seconds(e.get("duration"))
            duration_hours = duration_secs / 3600.0
            nonbillable = self.is_nonbillable(e)
            
            processed_entries.append({
                "activity": e.get("activity", {}).get("name", ""),
                "duration_hours": duration_hours,
                "nonbillable": nonbillable
            })
            
        result = {
            "entries": processed_entries,
            "generated_at": datetime.now().isoformat()
        }
        return Response(200, {"content-type": "application/json"}, bytes(json.dumps(result), "utf-8"))

    async def get_history_summary(self):
        try:
            with open("/history_summary.json", "r") as f:
                content = f.read()
            return Response(200, {"content-type": "application/json"}, bytes(content, "utf-8"))
        except Exception as e:
            return Response(500, {"content-type": "application/json"}, bytes(json.dumps({"error": str(e)}), "utf-8"))
