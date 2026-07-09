package com.kingdon.timetracker

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class DashboardTest {

    @Test
    fun testWasmIntegrationFlow() {
        val appContext = InstrumentationRegistry.getInstrumentation().targetContext
        val brainHost = BrainHost(appContext)

        // Recorded mock API response from early.app
        val mockApiResponse = """
        [
            {
                "activity": {"name": "Coding"},
                "duration": {"startedAt": "2026-07-08T08:00:00Z", "stoppedAt": "2026-07-08T12:00:00Z"},
                "note": {"text": "Android port", "tags": []}
            },
            {
                "activity": {"name": "Travel"},
                "duration": {"startedAt": "2026-07-08T12:00:00Z", "stoppedAt": "2026-07-08T14:00:00Z"},
                "note": {"text": "Commute", "tags": [{"label": "nonbillable"}]}
            }
        ]
        """.trimIndent()

        val jsonArray = JSONArray(mockApiResponse)

        // Build target input JSON for WASM brain
        val targetInput = JSONObject().apply {
            put("today", "2026-07-08")
            put("start_date", "2026-07-01")
            put("end_date", "2026-07-31")
            put("entries", jsonArray)
        }

        // Call the brain module
        val outputStr = brainHost.computeMonthlyTarget(targetInput.toString())
        val response = JSONObject(outputStr)
        assertFalse(response.has("error"))

        val progress = response.getJSONObject("progress")
        assertEquals(6.0, progress.getDouble("total_hours"), 0.001)
        assertEquals(4.0, progress.getDouble("billable_hours"), 0.001)
        assertEquals(6, progress.getInt("weekdays")) // 2026-07-01 to 2026-07-08 is 6 weekdays
        assertEquals(48.0, progress.getDouble("expected_hours"), 0.001)
        assertEquals(-44.0, progress.getDouble("hours_diff"), 0.001)

        val entries = response.getJSONArray("entries")
        assertEquals(2, entries.length())
        assertEquals("Coding", entries.getJSONObject(0).getString("activity"))
        assertTrue(entries.getJSONObject(1).getBoolean("nonbillable"))
    }
}
