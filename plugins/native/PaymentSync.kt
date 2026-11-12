package com.duyld.admintranslate

import android.util.Log
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * App chỉ chuyển nguyên văn thông báo lên server.
 * Server tự phân tích, lưu, gọi VietQR và đánh dấu đã xử lý.
 */
object PaymentSync {
    private const val TAG = "PaymentSync"
    private const val API_BASE = "__API_BASE__"
    private const val ADMIN_TOKEN = "__ADMIN_TOKEN__"

    fun forward(title: String, text: String) {
        Thread {
            try {
                val body = JSONObject().put("title", title).put("text", text).toString()
                val (code, resp) = http(
                    "POST",
                    "$API_BASE/admin/notifications",
                    body,
                    mapOf("x-admin-token" to ADMIN_TOKEN, "Content-Type" to "application/json"),
                )
                if (code in 200..299) {
                    Log.i(TAG, "Đã gửi lên server: $resp")
                } else {
                    Log.e(TAG, "Server trả $code: $resp")
                }
            } catch (e: Exception) {
                // Không gửi được: thông báo này sẽ không được server nhận
                Log.e(TAG, "Lỗi gửi thông báo lên server", e)
            }
        }.start()
    }

    private fun http(method: String, url: String, body: String?, headers: Map<String, String>): Pair<Int, String> {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = method
            connectTimeout = 15_000
            readTimeout = 15_000
            headers.forEach { (k, v) -> setRequestProperty(k, v) }
            if (body != null) {
                doOutput = true
                outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) }
            }
        }
        try {
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() }.orEmpty()
            return code to text
        } finally {
            conn.disconnect()
        }
    }
}
