package com.kingdon.timetracker

import android.content.Context
import android.util.Log
import com.dylibso.chicory.runtime.Instance
import com.dylibso.chicory.wasm.Parser
import java.io.InputStream
import java.nio.charset.StandardCharsets

class BrainHost(context: Context) {
    private val instance: Instance
    private companion object {
        const val TAG = "BrainHost"
    }

    init {
        Log.d(TAG, "Loading brain.wasm from assets...")
        val wasmInputStream: InputStream = context.assets.open("brain.wasm")
        val module = Parser.parse(wasmInputStream)
        Log.d(TAG, "WASM module parsed successfully")
        
        val logger = com.dylibso.chicory.log.BasicLogger()
        val wasi = com.dylibso.chicory.wasi.WasiPreview1.builder()
            .withLogger(logger)
            .withOptions(com.dylibso.chicory.wasi.WasiOptions.builder().build())
            .build()
        Log.d(TAG, "WASI preview1 initialized")
        
        val store = com.dylibso.chicory.runtime.Store()
        for (f in wasi.toHostFunctions()) {
            store.addFunction(f)
        }
        instance = Instance.builder(module)
            .withImportValues(store.toImportValues())
            .build()
        Log.d(TAG, "WASM instance created successfully")
    }

    // Write input string to WASM memory input buffer and return its length
    private fun writeStringToWasmMemory(input: String): Int {
        val inputBufferFunc = instance.export("get_input_buffer_ptr")
        val inputBufferPtr = inputBufferFunc.apply()[0].toInt()

        val bytes = input.toByteArray(StandardCharsets.UTF_8)
        val memory = instance.memory()
        memory.write(inputBufferPtr, bytes)
        
        return bytes.size
    }

    // Read a null-terminated string from WASM memory starting at pointer
    private fun readStringFromWasmMemory(ptr: Int): String {
        val memory = instance.memory()
        val result = StringBuilder()
        var currentPtr = ptr
        while (true) {
            val b = memory.read(currentPtr).toInt()
            if (b == 0) break
            result.append(b.toChar())
            currentPtr++
        }
        return result.toString()
    }

    @Synchronized
    fun computeMonthlyTarget(inputJson: String): String {
        Log.d(TAG, "computeMonthlyTarget called with input length: ${inputJson.length}")
        val len = writeStringToWasmMemory(inputJson)
        val func = instance.export("compute_monthly_target")
        val results = func.apply(len.toLong())
        val resultPtr = results[0].toInt()
        val result = readStringFromWasmMemory(resultPtr)
        Log.d(TAG, "computeMonthlyTarget result length: ${result.length}")
        return result
    }

    @Synchronized
    fun computeSixMixture(inputJson: String): String {
        Log.d(TAG, "computeSixMixture called with input length: ${inputJson.length}")
        val len = writeStringToWasmMemory(inputJson)
        val func = instance.export("compute_six_mixture")
        val results = func.apply(len.toLong())
        val resultPtr = results[0].toInt()
        val result = readStringFromWasmMemory(resultPtr)
        Log.d(TAG, "computeSixMixture result length: ${result.length}")
        return result
    }

    @Synchronized
    fun computeMovingAverage(inputJson: String): String {
        Log.d(TAG, "computeMovingAverage called with input length: ${inputJson.length}")
        val len = writeStringToWasmMemory(inputJson)
        val func = instance.export("compute_moving_average")
        val results = func.apply(len.toLong())
        val resultPtr = results[0].toInt()
        val result = readStringFromWasmMemory(resultPtr)
        Log.d(TAG, "computeMovingAverage result length: ${result.length}")
        return result
    }
}
