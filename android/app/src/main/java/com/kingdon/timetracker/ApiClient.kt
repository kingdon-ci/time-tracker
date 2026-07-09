package com.kingdon.timetracker

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import org.json.JSONArray
import java.time.LocalDate
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.io.IOException

class ApiClient(private val apiKey: String, private val apiSecret: String) {
    private val client = OkHttpClient()
    private val mediaTypeJson = "application/json; charset=utf-8".toMediaType()

    private fun authenticate(): String? {
        val url = "https://api.early.app/api/v4/developer/sign-in"
        val bodyJson = JSONObject().apply {
            put("apiKey", apiKey)
            put("apiSecret", apiSecret)
        }
        val request = Request.Builder()
            .url(url)
            .post(bodyJson.toString().toRequestBody(mediaTypeJson))
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) return null
            val body = response.body?.string() ?: return null
            return JSONObject(body).optString("token", null)
        }
    }

    fun fetchTimeEntries(startDate: LocalDate, endDate: LocalDate): String {
        val token = authenticate() ?: throw IOException("Authentication failed")

        val nyZone = ZoneId.of("America/New_York")
        
        // Start date at 00:00:00 in America/New_York
        val startNy = ZonedDateTime.of(startDate.atStartOfDay(), nyZone)
        // End date at 23:59:59.999 in America/New_York
        val endNy = ZonedDateTime.of(endDate.atTime(23, 59, 59, 999_000_000), nyZone)

        // Convert to UTC
        val startUtc = startNy.withZoneSameInstant(ZoneId.of("UTC"))
        val endUtc = endNy.withZoneSameInstant(ZoneId.of("UTC"))

        // Format to ISO
        val formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS")
        val startIso = startUtc.format(formatter)
        val endIso = endUtc.format(formatter)

        val url = "https://api.early.app/api/v4/time-entries/$startIso/$endIso"
        val request = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .build()

        client.newCall(request).execute().use { response ->
            if (!response.isSuccessful) throw IOException("Failed to fetch time entries: ${response.code}")
            val bodyStr = response.body?.string() ?: "[]"
            // The Early API returns either a flat array of entries or an object with "timeEntries"/"data"
            // Let's normalize it to a flat array string if it's an object
            if (bodyStr.trim().startsWith("{")) {
                val obj = JSONObject(bodyStr)
                val arr = obj.optJSONArray("timeEntries") 
                    ?: obj.optJSONArray("data") 
                    ?: obj.optJSONArray("entries")
                    ?: JSONArray()
                return arr.toString()
            }
            return bodyStr
        }
    }
}
