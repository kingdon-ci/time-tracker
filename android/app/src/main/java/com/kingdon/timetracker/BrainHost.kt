package com.kingdon.timetracker

import android.content.Context
import com.dylibso.chicory.runtime.Instance
import com.dylibso.chicory.wasm.Parser
import java.io.InputStream

class BrainHost(context: Context) {
    private val instance: Instance

    init {
        val wasmInputStream: InputStream = context.assets.open("brain.wasm")
        val module = Parser.parse(wasmInputStream)
        val logger = com.dylibso.chicory.log.SystemLogger()
        val wasiOpts = com.dylibso.chicory.wasi.WasiOptions.builder().build()
        val wasi = com.dylibso.chicory.wasi.WasiPreview1(logger, wasiOpts)
        val store = com.dylibso.chicory.runtime.Store()
        for (f in wasi.toHostFunctions()) {
            store.addFunction(f)
        }
        instance = Instance.builder(module)
            .withImportValues(store.toImportValues())
            .build()
    }

    // Write input string to WASM memory input buffer and return its length
    private fun writeStringToWasmMemory(input: String): Int {
        val inputBufferFunc = instance.export("get_input_buffer_ptr")
        val inputBufferPtr = inputBufferFunc.apply()[0].toInt()

        val bytes = input.toByteArray(Charsets.UTF_8)
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
        val len = writeStringToWasmMemory(inputJson)
        val func = instance.export("compute_monthly_target")
        val results = func.apply(len.toLong())
        val resultPtr = results[0].toInt()
        return readStringFromWasmMemory(resultPtr)
    }

    @Synchronized
    fun computeSixMixture(inputJson: String): String {
        val len = writeStringToWasmMemory(inputJson)
        val func = instance.export("compute_six_mixture")
        val results = func.apply(len.toLong())
        val resultPtr = results[0].toInt()
        return readStringFromWasmMemory(resultPtr)
    }

    @Synchronized
    fun computeMovingAverage(inputJson: String): String {
        val len = writeStringToWasmMemory(inputJson)
        val func = instance.export("compute_moving_average")
        val results = func.apply(len.toLong())
        val resultPtr = results[0].toInt()
        return readStringFromWasmMemory(resultPtr)
    }
}
