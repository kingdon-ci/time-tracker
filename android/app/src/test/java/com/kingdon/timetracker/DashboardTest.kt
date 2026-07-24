package com.kingdon.timetracker

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test
import java.io.File
import com.dylibso.chicory.runtime.Instance
import com.dylibso.chicory.wasm.Parser
import com.dylibso.chicory.wasi.WasiPreview1

class DashboardTest {

    @Test
    fun testWasmIntegrationFlowOnJvm() {
        // Load WASM from assets directory directly as a file on JVM
        var wasmFile = File("src/main/assets/brain.wasm")
        if (!wasmFile.exists()) {
            wasmFile = File("app/src/main/assets/brain.wasm")
        }
        if (!wasmFile.exists()) {
            wasmFile = File("../app/src/main/assets/brain.wasm")
        }
        if (!wasmFile.exists()) {
            wasmFile = File("android/app/src/main/assets/brain.wasm")
        }
        assertTrue("WASM file should exist in assets", wasmFile.exists())
        
        val wasmInputStream = wasmFile.inputStream()
        val module = Parser.parse(wasmInputStream)
        val logger = com.dylibso.chicory.log.SystemLogger()
        val wasi = WasiPreview1.builder()
            .withLogger(logger)
            .withOptions(com.dylibso.chicory.wasi.WasiOptions.builder().build())
            .build()
        val store = com.dylibso.chicory.runtime.Store()
        for (f in wasi.toHostFunctions()) {
            store.addFunction(f)
        }
        val instance = Instance.builder(module)
            .withImportValues(store.toImportValues())
            .build()

        // Helper to write to WASM memory
        val inputBufferFunc = instance.export("get_input_buffer_ptr")
        val inputBufferPtr = inputBufferFunc.apply()[0].toInt()

        // Recorded mock API response
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

        // Build target input JSON
        val targetInput = JSONObject().apply {
            put("today", "2026-07-08")
            put("start_date", "2026-07-01")
            put("end_date", "2026-07-31")
            put("entries", jsonArray)
        }

        // Copy input to WASM memory
        val inputBytes = targetInput.toString().toByteArray(Charsets.UTF_8)
        val memory = instance.memory()
        memory.write(inputBufferPtr, inputBytes)

        // Run compute_monthly_target
        val func = instance.export("compute_monthly_target")
        val results = func.apply(inputBytes.size.toLong())
        val resultPtr = results[0].toInt()

        // Read output from WASM memory
        val resultBuilder = StringBuilder()
        var currentPtr = resultPtr
        while (true) {
            val b = memory.read(currentPtr).toInt()
            if (b == 0) break
            resultBuilder.append(b.toChar())
            currentPtr++
        }

        val response = JSONObject(resultBuilder.toString())
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

    @Test
    fun testStrictMathIsAppliedGlobally() {
        val wasmFile = File("src/main/assets/brain.wasm")
        if (!wasmFile.exists()) return // Skip if file not compiled yet
        
        val wasmInputStream = wasmFile.inputStream()
        val module = Parser.parse(wasmInputStream)
        val logger = com.dylibso.chicory.log.SystemLogger()
        val wasi = WasiPreview1.builder()
            .withLogger(logger)
            .withOptions(com.dylibso.chicory.wasi.WasiOptions.builder().build())
            .build()
        val store = com.dylibso.chicory.runtime.Store()
        for (f in wasi.toHostFunctions()) {
            store.addFunction(f)
        }
        val instance = Instance.builder(module)
            .withImportValues(store.toImportValues())
            .build()

        val inputBufferFunc = instance.export("get_input_buffer_ptr")
        val inputBufferPtr = inputBufferFunc.apply()[0].toInt()

        // Dec 2025: pre-April 2026. Under strict math, Dec 31 (Wednesday) counts, so 23 weekdays.
        // Under jubilee math, it would omit Dec 31 and report 22 weekdays.
        val targetInput = JSONObject().apply {
            put("today", "2026-07-08") // today is outside Dec 2025, so Dec 2025 is a past month
            put("start_date", "2025-12-01")
            put("end_date", "2025-12-31")
            put("entries", JSONArray())
        }

        val inputBytes = targetInput.toString().toByteArray(Charsets.UTF_8)
        val memory = instance.memory()
        memory.write(inputBufferPtr, inputBytes)

        val func = instance.export("compute_monthly_target")
        val results = func.apply(inputBytes.size.toLong())
        val resultPtr = results[0].toInt()

        val resultBuilder = StringBuilder()
        var currentPtr = resultPtr
        while (true) {
            val b = memory.read(currentPtr).toInt()
            if (b == 0) break
            resultBuilder.append(b.toChar())
            currentPtr++
        }

        val response = JSONObject(resultBuilder.toString())
        assertFalse(response.has("error"))

        val progress = response.getJSONObject("progress")
        assertEquals(23, progress.getInt("weekdays")) // Strict math counts all 23 weekdays
        assertEquals(184.0, progress.getDouble("expected_hours"), 0.001)
    }
}
