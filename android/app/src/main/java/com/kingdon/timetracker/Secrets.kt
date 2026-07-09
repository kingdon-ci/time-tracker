package com.kingdon.timetracker

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

object SecretsManager {
    private const val PREFS_FILE = "secure_secrets"
    private const val KEY_API_KEY = "early_api_key"
    private const val KEY_API_SECRET = "early_api_secret"

    private fun getSharedPrefs(context: Context) = EncryptedSharedPreferences.create(
        context,
        PREFS_FILE,
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveCredentials(context: Context, apiKey: String, apiSecret: String) {
        getSharedPrefs(context).edit().apply {
            putString(KEY_API_KEY, apiKey)
            putString(KEY_API_SECRET, apiSecret)
            apply()
        }
    }

    fun getApiKey(context: Context): String? {
        return getSharedPrefs(context).getString(KEY_API_KEY, null)
    }

    fun getApiSecret(context: Context): String? {
        return getSharedPrefs(context).getString(KEY_API_SECRET, null)
    }

    fun clearCredentials(context: Context) {
        getSharedPrefs(context).edit().apply {
            remove(KEY_API_KEY)
            remove(KEY_API_SECRET)
            apply()
        }
    }

    fun hasCredentials(context: Context): Boolean {
        val prefs = getSharedPrefs(context)
        return prefs.contains(KEY_API_KEY) && prefs.contains(KEY_API_SECRET)
    }
}
