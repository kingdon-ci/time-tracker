package com.kingdon.timetracker

import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.*
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.TextStyle as ComposeTextStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.format.TextStyle
import java.util.Locale
import java.io.InputStream
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

class MainActivity : ComponentActivity() {
    private lateinit var brainHost: BrainHost

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        // Preload and cache WASM brain
        try {
            brainHost = BrainHost(applicationContext)
        } catch (e: Exception) {
            Toast.makeText(this, "Failed to load WASM: ${e.message}", Toast.LENGTH_LONG).show()
        }

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Color(0xFF0E0E10),
                    surface = Color(0xFF1C1C24),
                    primary = Color(0xFFFF9800),
                    secondary = Color(0xFF00BCD4),
                    error = Color(0xFFE91E63)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val viewModel: TimeTrackerViewModel = viewModel()
                    viewModel.initBrain(brainHost)
                    TimeTrackerApp(viewModel)
                }
            }
        }
    }
}

// UI State
sealed interface UiState {
    object Onboarding : UiState
    object Loading : UiState
    data class Dashboard(
        val progress: TargetProgressData,
        val entries: List<CleanEntryData>,
        val sixMixture: List<SixMixtureDay>,
        val history: HistorySummaryData,
        val compTimeBalance: Double,
        val lookbackCount: Int,
        val isCurrentMonth: Boolean
    ) : UiState
    data class Error(val message: String) : UiState
}

// Data Models
data class TargetProgressData(
    val totalHours: Double,
    val billableHours: Double,
    val expectedHours: Double,
    val percentage: Double,
    val hoursDiff: Double,
    val status: String,
    val weekdays: Int,
    val startDate: String,
    val endDate: String
)

data class CleanEntryData(
    val activity: String,
    val duration: String,
    val durationHours: Double,
    val note: String,
    val nonbillable: Boolean,
    val date: String?
)

data class SixMixtureDay(
    val date: String,
    val billable: Double,
    val nonbillable: Double
)

data class HistoryMonthData(
    val year: Int,
    val month: Int,
    val totalHours: Double,
    val expectedHours: Double,
    val hoursDiff: Double,
    val percentage: Double,
    val weekdays: Int,
    val movingAvg4m: Double?
)

data class HistorySummaryData(
    val compTimeBalance: Double,
    val lookbackCount: Int,
    val historicalDiff: Double,
    val months: List<HistoryMonthData>
)

// Extension Parsers
fun JSONObject.toTargetProgress() = TargetProgressData(
    totalHours = optDouble("total_hours", 0.0),
    billableHours = optDouble("billable_hours", 0.0),
    expectedHours = optDouble("expected_hours", 0.0),
    percentage = optDouble("percentage", 0.0),
    hoursDiff = optDouble("hours_diff", 0.0),
    status = optString("status", "under"),
    weekdays = optInt("weekdays", 0),
    startDate = optString("start_date", ""),
    endDate = optString("end_date", "")
)

fun JSONObject.toCleanEntry() = CleanEntryData(
    activity = optString("activity", ""),
    duration = optString("duration", ""),
    durationHours = optDouble("duration_hours", 0.0),
    note = optString("note", ""),
    nonbillable = optBoolean("nonbillable", false),
    date = optString("date", null)
)

fun JSONObject.toSixMixtureDay() = SixMixtureDay(
    date = optString("date", ""),
    billable = optDouble("billable", 0.0),
    nonbillable = optDouble("nonbillable", 0.0)
)

fun JSONObject.toHistoryMonth() = HistoryMonthData(
    year = optInt("year", 0),
    month = optInt("month", 0),
    totalHours = optDouble("total_hours", 0.0),
    expectedHours = optDouble("expected_hours", 0.0),
    hoursDiff = optDouble("hours_diff", 0.0),
    percentage = optDouble("percentage", 0.0),
    weekdays = optInt("weekdays", 0),
    movingAvg4m = if (isNull("moving_avg_4m")) null else optDouble("moving_avg_4m", 0.0)
)

class TimeTrackerViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<UiState>(UiState.Loading)
    val uiState: StateFlow<UiState> = _uiState

    private var _viewDate = MutableStateFlow(LocalDate.now(ZoneId.of("America/New_York")).withDayOfMonth(1))
    val viewDate: StateFlow<LocalDate> = _viewDate

    private var brainHost: BrainHost? = null
    private var isFirstLoad = true

    fun initBrain(host: BrainHost) {
        if (brainHost == null) {
            brainHost = host
        }
    }

    fun checkOnboardingAndLoad(context: android.content.Context) {
        if (!isFirstLoad) return
        isFirstLoad = false
        if (SecretsManager.hasCredentials(context)) {
            loadData(context)
        } else {
            _uiState.value = UiState.Onboarding
        }
    }

    fun saveCredentialsAndLoad(context: android.content.Context, apiKey: String, apiSecret: String) {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            val success = withContext(Dispatchers.IO) {
                try {
                    // Try to authenticate by fetching current month's pacing entries
                    val client = ApiClient(apiKey, apiSecret)
                    val today = LocalDate.now(ZoneId.of("America/New_York"))
                    client.fetchTimeEntries(today.withDayOfMonth(1), today)
                    true
                } catch (e: Exception) {
                    false
                }
            }
            if (success) {
                SecretsManager.saveCredentials(context, apiKey, apiSecret)
                loadData(context)
            } else {
                _uiState.value = UiState.Error("Failed to authenticate with Early API. Check credentials.")
            }
        }
    }

    fun clearCredentialsAndReset(context: android.content.Context) {
        SecretsManager.clearCredentials(context)
        _uiState.value = UiState.Onboarding
    }

    fun pageMonth(offset: Int, context: android.content.Context) {
        _viewDate.value = _viewDate.value.plusMonths(offset.toLong()).withDayOfMonth(1)
        loadData(context)
    }

    fun refresh(context: android.content.Context) {
        loadData(context)
    }

    private fun loadData(context: android.content.Context) {
        val brain = brainHost
        if (brain == null) {
            _uiState.value = UiState.Error("WASM Brain not initialized")
            return
        }

        viewModelScope.launch {
            _uiState.value = UiState.Loading
            try {
                val apiKey = SecretsManager.getApiKey(context)
                val apiSecret = SecretsManager.getApiSecret(context)
                if (apiKey == null || apiSecret == null) {
                    _uiState.value = UiState.Onboarding
                    return@launch
                }

                val currentViewDate = _viewDate.value
                val today = LocalDate.now(ZoneId.of("America/New_York"))
                val isCurrentMonth = currentViewDate.month == today.month && currentViewDate.year == today.year

                withContext(Dispatchers.IO) {
                    val client = ApiClient(apiKey, apiSecret)
                    val mainStart = currentViewDate
                    val mainEnd = currentViewDate.withDayOfMonth(currentViewDate.lengthOfMonth())

                    // 1. Fetch main entries
                    val rawEntriesStr = client.fetchTimeEntries(mainStart, mainEnd)
                    Log.d("TimeTrackerViewModel", "Raw entries from API: $rawEntriesStr")
                    
                    // Parse entries array
                    val entriesJsonArray = JSONArray(rawEntriesStr)
                    Log.d("TimeTrackerViewModel", "Parsed ${entriesJsonArray.length()} entries")
                    
                    // Compile monthly target via WASM brain
                    val targetInput = JSONObject().apply {
                        put("today", today.toString())
                        put("start_date", mainStart.toString())
                        put("end_date", mainEnd.toString())
                        put("entries", entriesJsonArray)
                    }
                    Log.d("TimeTrackerViewModel", "Target input: ${targetInput.toString()}")
                    val targetOutputStr = brain.computeMonthlyTarget(targetInput.toString())
                    Log.d("TimeTrackerViewModel", "Target output: $targetOutputStr")
                    val targetResponse = JSONObject(targetOutputStr)
                    if (targetResponse.has("error")) {
                        throw Exception(targetResponse.getString("error"))
                    }

                    val progress = targetResponse.getJSONObject("progress").toTargetProgress()
                    val cleanEntries = mutableListOf<CleanEntryData>()
                    val entriesArr = targetResponse.getJSONArray("entries")
                    for (i in 0 until entriesArr.length()) {
                        cleanEntries.add(entriesArr.getJSONObject(i).toCleanEntry())
                    }

                    // 2. Fetch six-mixture data (only needed on active dashboard or mock for past months)
                    val sixEntries = mutableListOf<SixMixtureDay>()
                    if (isCurrentMonth) {
                        val sixStart = today.minusDays(5)
                        val rawSixStr = client.fetchTimeEntries(sixStart, today)
                        Log.d("TimeTrackerViewModel", "Raw six mixture entries from API: $rawSixStr")
                        val rawSixArr = JSONArray(rawSixStr)
                        
                        val sixInput = JSONObject().apply {
                            put("today", today.toString())
                            put("entries", rawSixArr)
                        }
                        Log.d("TimeTrackerViewModel", "Six mixture input: ${sixInput.toString()}")
                        val sixOutputStr = brain.computeSixMixture(sixInput.toString())
                        Log.d("TimeTrackerViewModel", "Six mixture output: $sixOutputStr")
                        val sixResponse = JSONObject(sixOutputStr)
                        val sixDaysArr = sixResponse.getJSONArray("entries")
                        for (i in 0 until sixDaysArr.length()) {
                            sixEntries.add(sixDaysArr.getJSONObject(i).toSixMixtureDay())
                        }
                    }

                    // 3. Load historical data from assets
                    val historyInputStream: InputStream = context.assets.open("history_summary.json")
                    val historyJsonStr = historyInputStream.bufferedReader().use { it.readText() }
                    val historyObj = JSONObject(historyJsonStr)
                    val rawHistoryMonths = historyObj.getJSONArray("months")

                    val historyMonths = mutableListOf<JSONObject>()
                    for (i in 0 until rawHistoryMonths.length()) {
                        historyMonths.add(rawHistoryMonths.getJSONObject(i))
                    }

                    // Compute moving average and comp time balance via WASM brain
                    val historyInput = JSONObject().apply {
                        put("view_year", currentViewDate.year)
                        put("view_month", currentViewDate.monthValue)
                        put("current_month_diff", progress.hoursDiff)
                        put("history", JSONArray(historyMonths))
                    }
                    Log.d("TimeTrackerViewModel", "History input: ${historyInput.toString()}")
                    
                    val historyOutputStr = brain.computeMovingAverage(historyInput.toString())
                    Log.d("TimeTrackerViewModel", "History output: $historyOutputStr")
                    val historyResponse = JSONObject(historyOutputStr)
                    if (historyResponse.has("error")) {
                        throw Exception(historyResponse.getString("error"))
                    }

                    val compTimeBalance = historyResponse.getDouble("comp_time_balance")
                    val lookbackCount = historyResponse.getInt("lookback_count")
                    val historicalDiff = historyResponse.getDouble("historical_diff")

                    val updatedMonths = mutableListOf<HistoryMonthData>()
                    val resMonthsArr = historyResponse.getJSONArray("months")
                    for (i in 0 until resMonthsArr.length()) {
                        updatedMonths.add(resMonthsArr.getJSONObject(i).toHistoryMonth())
                    }

                    val historySummary = HistorySummaryData(
                        compTimeBalance = compTimeBalance,
                        lookbackCount = lookbackCount,
                        historicalDiff = historicalDiff,
                        months = updatedMonths
                    )

                    _uiState.value = UiState.Dashboard(
                        progress = progress,
                        entries = cleanEntries,
                        sixMixture = sixEntries,
                        history = historySummary,
                        compTimeBalance = compTimeBalance,
                        lookbackCount = lookbackCount,
                        isCurrentMonth = isCurrentMonth
                    )
                }
            } catch (e: Exception) {
                _uiState.value = UiState.Error(e.message ?: "An unknown error occurred")
            }
        }
    }
}

@Composable
fun TimeTrackerApp(viewModel: TimeTrackerViewModel) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(Unit) {
        viewModel.checkOnboardingAndLoad(context)
    }

    AnimatedVisibility(
        visible = uiState is UiState.Loading,
        enter = fadeIn(),
        exit = fadeOut()
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = MaterialTheme.colorScheme.primary)
                Spacer(modifier = Modifier.height(16.dp))
                Text("Engaging WASM Brain...", color = Color.White, fontSize = 14.sp)
            }
        }
    }

    AnimatedVisibility(
        visible = uiState is UiState.Onboarding,
        enter = fadeIn(),
        exit = fadeOut()
    ) {
        OnboardingScreen(onSubmit = { key, secret ->
            viewModel.saveCredentialsAndLoad(context, key, secret)
        })
    }

    AnimatedVisibility(
        visible = uiState is UiState.Error,
        enter = fadeIn(),
        exit = fadeOut()
    ) {
        val state = uiState as? UiState.Error
        Box(modifier = Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0x33FFFFFF))
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Error Occurred", color = MaterialTheme.colorScheme.error, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(state?.message ?: "Unknown", color = Color.White, textAlign = TextAlign.Center, fontSize = 14.sp)
                    Spacer(modifier = Modifier.height(24.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(onClick = { viewModel.refresh(context) }) {
                            Text("Retry")
                        }
                        OutlinedButton(onClick = { viewModel.clearCredentialsAndReset(context) }) {
                            Text("Reset Keys")
                        }
                    }
                }
            }
        }
    }

    AnimatedVisibility(
        visible = uiState is UiState.Dashboard,
        enter = fadeIn(),
        exit = fadeOut()
    ) {
        val state = uiState as? UiState.Dashboard
        if (state != null) {
            DashboardScreen(state = state, viewModel = viewModel)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OnboardingScreen(onSubmit: (String, String) -> Unit) {
    var key by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }

    Box(
        modifier = Modifier.fillMaxSize().background(Color(0xFF0E0E10)).padding(24.dp),
        contentAlignment = Alignment.Center
    ) {
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C24)),
            shape = RoundedCornerShape(16.dp),
            border = BorderStroke(1.dp, Color(0x22FFFFFF))
        ) {
            Column(
                modifier = Modifier.padding(24.dp).fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = "Time Carburetor",
                    color = Color.White,
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace
                )
                Text(
                    text = "Onboarding",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(modifier = Modifier.height(24.dp))
                
                OutlinedTextField(
                    value = key,
                    onValueChange = { key = it },
                    label = { Text("EARLY_API_KEY") },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(modifier = Modifier.height(16.dp))

                OutlinedTextField(
                    value = secret,
                    onValueChange = { secret = it },
                    label = { Text("EARLY_API_SECRET") },
                    singleLine = true,
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = MaterialTheme.colorScheme.primary,
                        unfocusedTextColor = Color.White
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(32.dp))
                Button(
                    onClick = { if (key.isNotBlank() && secret.isNotBlank()) onSubmit(key, secret) },
                    enabled = key.isNotBlank() && secret.isNotBlank(),
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth().height(48.dp)
                ) {
                    Text("Connect to early.app", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun DashboardScreen(state: UiState.Dashboard, viewModel: TimeTrackerViewModel) {
    val context = LocalContext.current
    val viewDate by viewModel.viewDate.collectAsState()
    val today = LocalDate.now(ZoneId.of( "America/New_York"))
    val isCurrentMonth = viewDate.month == today.month && viewDate.year == today.year
    
    var activeModalType by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF0E0E10))
                    .statusBarsPadding()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column {
                        Text(
                            text = "Time Carburetor",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = FontFamily.Monospace
                        )
                        Text(
                            text = "Zero-Split-Brain Dashboard",
                            color = Color.Gray,
                            fontSize = 11.sp
                        )
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        IconButton(
                            onClick = { viewModel.refresh(context) },
                            modifier = Modifier
                                .size(36.dp)
                                .background(Color(0xFF1C1C24), RoundedCornerShape(8.dp))
                        ) {
                            Icon(
                                imageVector = Icons.Default.Refresh,
                                contentDescription = "Refresh",
                                tint = MaterialTheme.colorScheme.primary,
                                modifier = Modifier.size(18.dp)
                            )
                        }

                        Button(
                            onClick = { viewModel.clearCredentialsAndReset(context) },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0x1AFFFFFF)),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(36.dp)
                        ) {
                            Text("Reset", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        },
        bottomBar = {
            // Month Pager
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF1C1C24))
                    .navigationBarsPadding()
                    .padding(horizontal = 24.dp, vertical = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    OutlinedButton(
                        onClick = { viewModel.pageMonth(-1, context) },
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("< Prev", color = Color.White)
                    }

                    Text(
                        text = viewDate.month.getDisplayName(TextStyle.FULL, Locale.US) + " " + viewDate.year,
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp
                    )

                    OutlinedButton(
                        onClick = { viewModel.pageMonth(1, context) },
                        enabled = !isCurrentMonth,
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Next >", color = if (!isCurrentMonth) Color.White else Color.Gray)
                    }
                }
            }
        }
    ) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .background(Color(0xFF0E0E10))
                .padding(innerPadding)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Gauge 1: Monthly pacing
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { activeModalType = "pacing" },
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C24)),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0x11FFFFFF))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        CarburetorGauge(
                            value = state.progress.hoursDiff,
                            min = -40f,
                            max = 40f,
                            label = "Monthly Billable Balance",
                            unit = "hrs"
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceEvenly
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Billable", color = Color.Gray, fontSize = 11.sp)
                                Text("${state.progress.billableHours}h", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Expected", color = Color.Gray, fontSize = 11.sp)
                                Text("${state.progress.expectedHours}h", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("Performance", color = Color.Gray, fontSize = 11.sp)
                                Text("${state.progress.percentage}%", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            }
                        }
                    }
                }
            }

            // Gauge 2: Rolling Comp Balance
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { activeModalType = "bank" },
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C24)),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0x11FFFFFF))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.size(100.dp)) {
                            CarburetorGauge(
                                value = state.compTimeBalance,
                                min = -80f,
                                max = 80f,
                                label = "",
                                unit = "h",
                                showLabel = false
                            )
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text("Rolling Comp Balance", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                            Text("Calculated over last ${state.lookbackCount} months", color = Color.Gray, fontSize = 11.sp)
                            Spacer(modifier = Modifier.height(4.dp))
                            val trendColor = if (state.history.historicalDiff >= 0) Color(0xFF4CAF50) else Color(0xFFE91E63)
                            Text(
                                text = "YTD Historical: " + (if (state.history.historicalDiff >= 0) "+" else "") + "${state.history.historicalDiff}h",
                                color = trendColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            }

            // Gauge 3: Six Mixture (Active Month only)
            if (state.isCurrentMonth && state.sixMixture.isNotEmpty()) {
                item {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { activeModalType = "energy" },
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C24)),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, Color(0x11FFFFFF))
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(16.dp)
                        ) {
                            val sixBillable = state.sixMixture.sumOf { it.billable }
                            val sixNonBillable = state.sixMixture.sumOf { it.nonbillable }
                            MixtureGauge(
                                billable = sixBillable,
                                nonbillable = sixNonBillable,
                                label = "Make Six Mixture"
                            )

                            Spacer(modifier = Modifier.height(8.dp))
                            HorizontalDivider(color = Color(0x11FFFFFF))
                            Spacer(modifier = Modifier.height(12.dp))

                            // Daily breakdown - restores per-day visibility that the aggregate gauge above obscures
                            MixtureChart(days = state.sixMixture, label = "Daily Breakdown")
                        }
                    }
                }
            }

            // Trend Chart
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C24)),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0x11FFFFFF))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp)
                    ) {
                        Text(
                            text = "Historical Trend (Monthly)",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        TrendChart(months = state.history.months)
                    }
                }
            }

            // Work logs list
            item {
                Text(
                    text = "Entries this Period",
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            if (state.entries.isEmpty()) {
                item {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(100.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("No entries recorded", color = Color.Gray, fontSize = 14.sp)
                    }
                }
            } else {
                items(state.entries) { entry ->
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C24)),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(12.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(entry.activity, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                if (entry.note.isNotBlank()) {
                                    Text(entry.note, color = Color.Gray, fontSize = 11.sp, maxLines = 1)
                                }
                                entry.date?.let {
                                    Text(it, color = Color.DarkGray, fontSize = 9.sp)
                                }
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = entry.duration,
                                    color = if (entry.nonbillable) Color(0xFF00BCD4) else Color(0xFFFF9800),
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                                Text(
                                    text = if (entry.nonbillable) "Air" else "Fuel",
                                    color = if (entry.nonbillable) Color(0x8800BCD4) else Color(0x88FF9800),
                                    fontSize = 9.sp
                                )
                            }
                        }
                    }
                }
            }

            // Add bottom spacing
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }

    // Modal dialogs for gauges details
    activeModalType?.let { type ->
        Dialog(onDismissRequest = { activeModalType = null }) {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF1C1C24)),
                shape = RoundedCornerShape(16.dp),
                border = BorderStroke(1.dp, Color(0x33FFFFFF)),
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Column(modifier = Modifier.padding(24.dp)) {
                    when (type) {
                        "pacing" -> {
                            Text("Monthly Pacing Details", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("Pacing calculates your expected working hours against standard 8h/day (Mon-Fri) for the month to date.", color = Color.Gray, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Current balance is: " + (if (state.progress.hoursDiff >= 0) "+" else "") + "${state.progress.hoursDiff} hours.", color = MaterialTheme.colorScheme.primary, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                        "bank" -> {
                            Text("Rolling Comp Details", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("Rolling comp includes the previous 5 months plus the current month's active pacing.", color = Color.Gray, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("YTD balance: ${state.history.historicalDiff}h", color = Color.White, fontSize = 13.sp)
                            Text("Active month pacing: ${state.progress.hoursDiff}h", color = Color.White, fontSize = 13.sp)
                        }
                        "energy" -> {
                            Text("Make Six Mixture Details", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                            Spacer(modifier = Modifier.height(12.dp))
                            Text("The fuel mixture represents the proportion of billable hours (Fuel) and nonbillable hours (Air) over a rolling 6-day window.", color = Color.Gray, fontSize = 13.sp)
                            Spacer(modifier = Modifier.height(16.dp))
                            Text("Keep billable hours high to keep the carburetor running efficiently!", color = MaterialTheme.colorScheme.secondary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                    Spacer(modifier = Modifier.height(24.dp))
                    Button(
                        onClick = { activeModalType = null },
                        modifier = Modifier.align(Alignment.End)
                    ) {
                        Text("Close")
                    }
                }
            }
        }
    }
}

@Composable
fun CarburetorGauge(
    value: Double,
    min: Float,
    max: Float,
    label: String,
    unit: String,
    modifier: Modifier = Modifier,
    showLabel: Boolean = true
) {
    val clampedValue = value.coerceIn(min.toDouble(), max.toDouble()).toFloat()
    val sweepAngle = 180f
    val startAngle = 180f

    val progress = (clampedValue - min) / (max - min)
    val color = if (clampedValue >= 0) Color(0xFF4CAF50) else Color(0xFFE91E63)

    Column(
        modifier = modifier.fillMaxWidth().height(120.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier.size(140.dp).padding(top = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val strokeWidth = 14.dp.toPx()
                val radius = (size.minDimension - strokeWidth) / 2
                val arcSize = Size(radius * 2, radius * 2)
                val topLeft = Offset((size.width - radius * 2) / 2, (size.height - radius * 2) / 2)

                // Background Arch
                drawArc(
                    color = Color(0x1AFFFFFF),
                    startAngle = startAngle,
                    sweepAngle = sweepAngle,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )

                // Colored progress arch
                drawArc(
                    color = color,
                    startAngle = startAngle,
                    sweepAngle = sweepAngle * progress,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )

                // Needle logic
                val needleLength = radius - 8.dp.toPx()
                val needleAngleRad = (startAngle + sweepAngle * progress) * PI / 180f
                val needleEnd = Offset(
                    center.x + needleLength.toFloat() * cos(needleAngleRad).toFloat(),
                    center.y + needleLength.toFloat() * sin(needleAngleRad).toFloat()
                )
                
                // Draw needle pin
                drawCircle(
                    color = Color.White,
                    radius = 6.dp.toPx(),
                    center = center
                )

                // Draw needle line
                drawLine(
                    color = Color.White,
                    start = center,
                    end = needleEnd,
                    strokeWidth = 3.dp.toPx(),
                    cap = StrokeCap.Round
                )
            }

            // Numeric Display inside Arc - anchored from top for predictable, non-overlapping placement
            Column(
                modifier = Modifier.align(Alignment.TopCenter).padding(top = 80.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                val valueText = (if (clampedValue >= 0) "+" else "") + String.format("%.1f", clampedValue)
                Text(
                    text = valueText + unit,
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    fontFamily = FontFamily.Monospace
                )
                if (showLabel && label.isNotBlank()) {
                    Text(
                        text = label,
                        color = Color.Gray,
                        fontSize = 9.sp,
                        textAlign = TextAlign.Center
                    )
                }
            }
        }
    }
}

@Composable
fun MixtureGauge(
    billable: Double,
    nonbillable: Double,
    label: String,
    modifier: Modifier = Modifier
) {
    val total = billable + nonbillable
    val billablePercent = if (total > 0) (billable / total) * 100.0 else 0.0
    val progress = billablePercent / 100.0

    // Matches CarburetorGauge's proven dome shape: startAngle=180, sweepAngle=180 (opens at bottom)
    val startAngle = 180f
    val sweepAngle = 180f

    Column(
        modifier = modifier.fillMaxWidth().wrapContentHeight(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier.size(140.dp).padding(top = 8.dp),
            contentAlignment = Alignment.Center
        ) {
            Canvas(modifier = Modifier.fillMaxSize()) {
                val strokeWidth = 14.dp.toPx()
                val radius = (size.minDimension - strokeWidth) / 2
                val arcSize = Size(radius * 2, radius * 2)
                val topLeft = Offset((size.width - radius * 2) / 2, (size.height - radius * 2) / 2)

                // AIR zone (left half of dome - cyan)
                drawArc(
                    color = Color(0xFF00BCD4),
                    startAngle = startAngle,
                    sweepAngle = sweepAngle / 2f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )

                // FUEL zone (right half of dome - orange)
                drawArc(
                    color = Color(0xFFFF9800),
                    startAngle = startAngle + sweepAngle / 2f,
                    sweepAngle = sweepAngle / 2f,
                    useCenter = false,
                    topLeft = topLeft,
                    size = arcSize,
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Round)
                )

                // Needle logic (same math as CarburetorGauge)
                val needleLength = radius - 8.dp.toPx()
                val needleAngleRad = (startAngle + sweepAngle * progress) * PI / 180f
                val needleEnd = Offset(
                    center.x + needleLength.toFloat() * cos(needleAngleRad).toFloat(),
                    center.y + needleLength.toFloat() * sin(needleAngleRad).toFloat()
                )

                // Draw needle pin
                drawCircle(
                    color = Color.White,
                    radius = 6.dp.toPx(),
                    center = center
                )

                // Draw needle line
                drawLine(
                    color = Color.White,
                    start = center,
                    end = needleEnd,
                    strokeWidth = 3.dp.toPx(),
                    cap = StrokeCap.Round
                )
            }

            // Numeric Display inside Arc (matches CarburetorGauge pattern - single line like "+0.6hrs")
            Column(
                modifier = Modifier.offset(y = 10.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = String.format("%.0f%% RICH", billablePercent),
                    color = Color.White,
                    fontWeight = FontWeight.Bold,
                    fontSize = 20.sp,
                    fontFamily = FontFamily.Monospace
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Numeric values below gauge, matching the "stats" row style of other panels
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = "FUEL", color = Color(0xFFFF9800), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Text(text = String.format("%.1fh", billable), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.width(32.dp))
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = "AIR", color = Color(0xFF00BCD4), fontSize = 9.sp, fontWeight = FontWeight.Bold)
                Text(text = String.format("%.1fh", nonbillable), color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun MixtureChart(days: List<SixMixtureDay>, label: String) {
    val maxVal = days.maxOfOrNull { it.billable + it.nonbillable }?.coerceAtLeast(8.0) ?: 8.0

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = label.uppercase(Locale.US),
            color = Color.Gray,
            fontSize = 10.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 1.sp,
            modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
            textAlign = TextAlign.Center
        )

        Row(
            modifier = Modifier.fillMaxWidth().height(100.dp).padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            days.forEach { day ->
                val total = day.billable + day.nonbillable
                
                Column(
                    modifier = Modifier.weight(1f).fillMaxHeight(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Bottom
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .background(Color(0xFF33333C), RoundedCornerShape(4.dp))
                            .border(1.dp, Color(0x11FFFFFF), RoundedCornerShape(4.dp))
                    ) {
                        Canvas(modifier = Modifier.fillMaxSize()) {
                            val barWidth = size.width
                            val maxHeight = size.height

                            val billableHeight = (day.billable / maxVal) * maxHeight
                            val nonbillableHeight = (day.nonbillable / maxVal) * maxHeight

                            // Stacked drawing
                            // Billable (Fuel) Orange
                            drawRect(
                                color = Color(0xFFFF9800),
                                topLeft = Offset(0f, (maxHeight - billableHeight).toFloat()),
                                size = Size(barWidth, billableHeight.toFloat())
                            )

                            // Nonbillable (Air) Cyan on top of Orange
                            drawRect(
                                color = Color(0xFF00BCD4),
                                topLeft = Offset(0f, (maxHeight - billableHeight - nonbillableHeight).toFloat()),
                                size = Size(barWidth, nonbillableHeight.toFloat())
                            )

                            // 8h dashed indicator line
                            if (maxVal > 8.0) {
                                val targetY = (maxHeight - (8.0 / maxVal) * maxHeight).toFloat()
                                drawLine(
                                    color = Color(0x55FFFFFF),
                                    start = Offset(0f, targetY),
                                    end = Offset(barWidth, targetY),
                                    strokeWidth = 1.dp.toPx(),
                                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(5f, 5f), 0f)
                                )
                            }
                        }
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = day.date.substring(day.date.length - 2),
                        color = if (total > 0) Color.White else Color.Gray,
                        fontSize = 8.sp,
                        fontWeight = if (total > 0) FontWeight.Bold else FontWeight.Normal
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(8.dp).background(Color(0xFFFF9800), RoundedCornerShape(2.dp)))
                Spacer(modifier = Modifier.width(4.dp))
                Text("FUEL (Billable)", color = Color(0xFFFF9800), fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(modifier = Modifier.width(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(8.dp).background(Color(0xFF00BCD4), RoundedCornerShape(2.dp)))
                Spacer(modifier = Modifier.width(4.dp))
                Text("AIR (Nonbillable)", color = Color(0xFF00BCD4), fontSize = 9.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
fun TrendChart(months: List<HistoryMonthData>) {
    if (months.isEmpty()) return
    
    val maxDiff = months.maxOfOrNull { Math.abs(it.hoursDiff) }?.coerceAtLeast(20.0)?.toFloat() ?: 20f

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(150.dp)
            .padding(vertical = 12.dp)
    ) {
        Canvas(modifier = Modifier.fillMaxSize()) {
            val chartWidth = size.width
            val chartHeight = size.height
            val padding = 16.dp.toPx()

            val centerlineY = chartHeight / 2f
            
            // Draw centerline (0h)
            drawLine(
                color = Color(0x33FFFFFF),
                start = Offset(padding, centerlineY),
                end = Offset(chartWidth - padding, centerlineY),
                strokeWidth = 1.dp.toPx(),
                pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 4f), 0f)
            )

            val points = months.mapIndexed { idx, m ->
                val x = padding + (idx * (chartWidth - 2 * padding) / (months.size - 1).coerceAtLeast(1))
                // y goes downwards on android canvas
                val y = centerlineY - (m.hoursDiff.toFloat() / maxDiff) * (centerlineY - padding)
                Offset(x, y)
            }

            // Draw line connecting points
            val path = Path().apply {
                if (points.isNotEmpty()) {
                    moveTo(points[0].x, points[0].y)
                    for (i in 1 until points.size) {
                        lineTo(points[i].x, points[i].y)
                    }
                }
            }
            drawPath(
                path = path,
                color = Color(0xFF4CAF50),
                style = Stroke(width = 2.dp.toPx())
            )

            // Draw milestones
            months.forEachIndexed { idx, m ->
                val p = points[idx]
                
                // NB Tracking milestone (2025-08)
                if (m.year == 2025 && m.month == 8) {
                    drawLine(
                        color = Color(0x33FFFFFF),
                        start = Offset(p.x, padding),
                        end = Offset(p.x, chartHeight - padding),
                        strokeWidth = 1.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(2f, 2f), 0f)
                    )
                }

                // Strict Math milestone (2026-04)
                if (m.year == 2026 && m.month == 4) {
                    drawLine(
                        color = Color(0xFFFFA726),
                        start = Offset(p.x, padding),
                        end = Offset(p.x, chartHeight - padding),
                        strokeWidth = 1.dp.toPx(),
                        pathEffect = PathEffect.dashPathEffect(floatArrayOf(2f, 2f), 0f)
                    )
                }

                // Draw dot
                val dotColor = if (m.hoursDiff >= 0) Color(0xFF4CAF50) else Color(0xFFE91E63)
                drawCircle(
                    color = dotColor,
                    radius = 4.dp.toPx(),
                    center = p
                )
            }
        }
        
        // Render simple overlay text labels
        Row(
            modifier = Modifier.fillMaxWidth().align(Alignment.BottomCenter).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(months.first().year.toString() + "/" + months.first().month, color = Color.Gray, fontSize = 8.sp)
            Text(months.last().year.toString() + "/" + months.last().month, color = Color.White, fontSize = 8.sp, fontWeight = FontWeight.Bold)
        }
    }
}
