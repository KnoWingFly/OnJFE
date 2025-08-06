<template>
  <div>
    <!-- Anti-Cheat Rules Modal -->
    <Modal
      v-model="showRulesModal"
      :closable="false"
      :mask-closable="false"
      width="600"
      class-name="anti-cheat-modal"
    >
      <div slot="header">
        <Icon type="alert" style="color: #ff9900"></Icon>
        <span style="margin-left: 8px; font-weight: bold"
          >Contest Anti-Cheat System</span
        >
      </div>

      <div class="rules-content">
        <h3>Contest Rules & Anti-Cheat Policy</h3>
        <ul>
          <li>You must remain in fullscreen mode throughout the contest</li>
          <li>
            Switching tabs, pressing Alt+Tab, or opening developer tools is
            prohibited
          </li>
          <li>Any attempt to exit fullscreen will be detected and logged</li>
          <li>
            Each violation will add 10 minutes penalty to your submission time
          </li>
          <li>Multiple violations may result in disqualification</li>
        </ul>

        <!-- Show current penalty status -->
        <div v-if="violationCount > 0" class="current-penalty">
          <Icon type="information-circled" style="color: #ed4014"></Icon>
          <span
            >You currently have {{ violationCount }} violations ({{
              violationCount * 10
            }}
            minutes penalty)</span
          >
        </div>

        <div class="warning-box">
          <Icon type="information-circled" style="color: #2d8cf0"></Icon>
          <span
            >By accepting, you agree to follow these rules and understand the
            consequences of violations.</span
          >
        </div>
      </div>

      <div slot="footer">
        <Button @click="declineRules" style="margin-right: 8px">Go Back</Button>
        <Button type="primary" @click="acceptRules" :loading="acceptingRules"
          >Accept & Continue</Button
        >
      </div>
    </Modal>

    <!-- Cheat Detection Warning Modal -->
    <Modal
      v-model="showWarningModal"
      :closable="false"
      :mask-closable="false"
      width="500"
      class-name="cheat-warning-modal"
    >
      <div slot="header" style="color: #ed4014">
        <Icon type="alert" style="color: #ed4014"></Icon>
        <span style="margin-left: 8px; font-weight: bold"
          >Cheating Detected!</span
        >
      </div>

      <div class="warning-content">
        <p><strong>Violation:</strong> {{ lastViolation }}</p>
        <p><strong>Total Violations:</strong> {{ violationCount }}</p>
        <p>
          <strong>Penalty:</strong> +10 minutes will be added to your next
          correct submission
        </p>

        <div class="violation-warning">
          <Icon type="ios-warning" style="color: #ff9900"></Icon>
          <span
            >Please return to fullscreen mode and avoid further
            violations.</span
          >
        </div>

        <!-- Countdown timer display -->
        <div v-if="!canCloseModal" class="countdown-warning">
          <Icon type="ios-time" style="color: #2d8cf0"></Icon>
          <span>
            You must wait {{ modalCountdown }} seconds before continuing...
          </span>
          <div class="countdown-bar">
            <div
              class="countdown-progress"
              :style="{ width: `${((15 - modalCountdown) / 15) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>

      <div slot="footer">
        <Button
          type="primary"
          @click="acknowledgeWarning"
          :disabled="!canCloseModal"
          :loading="!canCloseModal"
        >
          <span v-if="canCloseModal">I Understand</span>
          <span v-else>Wait {{ modalCountdown }}s</span>
        </Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import api from "@oj/api";

export default {
  name: "AntiCheat",
  props: {
    contestId: {
      type: [String, Number],
      required: true,
    },
    problemId: {
      type: [String, Number],
      required: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    // Add prop to receive problem status from parent
    problemStatus: {
      type: Number,
      default: null,
    },
  },

  data() {
    return {
      showRulesModal: false,
      showWarningModal: false,
      acceptingRules: false,
      isFullscreen: false,
      isMonitoring: false,
      violationCount: 0,
      lastViolation: "",
      tabSwitchDetected: false,
      keyboardListenerActive: false,
      visibilityListenerActive: false,
      mouseListenerActive: false,
      contextMenuListenerActive: false,
      devToolsOpen: false,
      lastWindowHeight: window.innerHeight,
      lastWindowWidth: window.innerWidth,
      problemSolved: false,
      pendingViolations: new Set(),
      modalCloseTimer: null,
      canCloseModal: false,
      modalCountdown: 15,
      hasEnteredFullscreenBefore: false, // Add this new flag
      problemViolationCount: 0, // Violations for current problem only
      totalViolationCount: 0, // Total violations across all problems
    };
  },

  mounted() {
    console.log("AntiCheat component mounted", {
      contestId: this.contestId,
      problemId: this.problemId,
      isActive: this.isActive,
    });

    if (this.isActive && this.contestId && this.problemId) {
      // Use nextTick to ensure DOM is ready
      this.$nextTick(() => {
        this.initializeAntiCheat();
      });
    }
  },

  beforeDestroy() {
    this.cleanup();
  },

  methods: {
    async initializeAntiCheat() {
      console.log(
        `Initializing anti-cheat for contest ${this.contestId}, problem ${this.problemId}`
      );

      if (
        !this.problemId ||
        this.problemId === "undefined" ||
        this.problemId === "" ||
        this.problemId === null
      ) {
        console.error("Invalid problem ID:", this.problemId);
        this.$emit("anti-cheat-declined");
        return;
      }

      // Convert problem ID to string to ensure consistency
      const problemIdStr = String(this.problemId);
      console.log(
        `Using problem ID: ${problemIdStr} (type: ${typeof problemIdStr})`
      );

      // Check problem-specific anti-cheat status
      try {
        console.log(
          `Checking anti-cheat status for contest ${this.contestId}, problem ${problemIdStr}`
        );

        const statusRes = await api.checkProblemAntiCheatStatus(
          this.contestId,
          problemIdStr
        );

        console.log("Anti-cheat status response:", statusRes);

        if (statusRes && statusRes.data && statusRes.data.data) {
          const data = statusRes.data.data;

          // FIXED: Set ONLY problem-specific violation counts
          this.problemViolationCount = data.problem_violation_count || 0;
          this.violationCount = this.problemViolationCount; // Only show THIS problem's violations

          console.log(
            `Problem ${problemIdStr} violation count: ${this.problemViolationCount}`
          );

          // Check if problem is already solved
          if (data.problem_solved) {
            console.log("Problem already solved, skipping anti-cheat");
            this.$emit("problem-solved");
            return;
          }

          // Show current penalty status for THIS problem only
          if (this.problemViolationCount > 0) {
            this.$Message.info({
              content: `This problem has ${
                this.problemViolationCount
              } violations (${
                this.problemViolationCount * 10
              } minutes penalty)`,
              duration: 6,
            });
          }
        } else {
          console.warn(
            "No valid anti-cheat status data received, using defaults"
          );
          this.problemViolationCount = 0;
          this.violationCount = 0;
        }
      } catch (error) {
        console.error("Anti-cheat status check failed:", error);

        // More specific error handling
        if (error.isApiError) {
          const errorMessage = error.message || "Unknown API error";
          console.error(`API Error: ${errorMessage}`);

          if (errorMessage.includes("Problem not found in this contest")) {
            this.$Message.error({
              content: `Problem ${problemIdStr} not found in contest ${this.contestId}. Please refresh the page.`,
              duration: 8,
            });
            this.$emit("anti-cheat-declined");
            return;
          } else if (errorMessage.includes("Contest not found")) {
            this.$Message.error({
              content: `Contest ${this.contestId} not found. Please check the contest.`,
              duration: 8,
            });
            this.$emit("anti-cheat-declined");
            return;
          }
        }

        // For other errors, use defaults but continue
        console.warn("Using default values due to error:", error.message);
        this.problemViolationCount = 0;
        this.violationCount = 0;
      }

      // Check if rules were already accepted for this specific problem
      const rulesKey = `contest_rules_${this.contestId}_${problemIdStr}`;
      const rulesAccepted = localStorage.getItem(rulesKey);

      if (!rulesAccepted) {
        this.showRulesModal = true;
      } else {
        this.startMonitoring();
      }
    },

    async loadViolationStatus() {
      try {
        const res = await api.checkAntiCheatStatus(this.contestId);

        if (res && res.data && res.data.data) {
          this.violationCount = res.data.data.violation_count || 0;
          console.log(`Loaded violation count: ${this.violationCount}`);
        } else {
          console.warn("No valid violation status data, using default");
          this.violationCount = 0;
        }
      } catch (error) {
        console.warn("Failed to load violation status:", error);
        // Set default violation count instead of failing
        this.violationCount = 0;
      }
    },

    // Method to handle when problem is solved
    onProblemSolved() {
      const rulesKey = `contest_rules_${this.contestId}_${this.problemId}`;
      const cooldownKey = `last_violation_${this.contestId}_${this.problemId}`;

      localStorage.removeItem(rulesKey);
      localStorage.removeItem(cooldownKey);

      this.stopMonitoring();
      this.problemSolved = true;

      this.$Message.success({
        content: "Anti-cheat monitoring disabled for this solved problem.",
        duration: 5,
      });

      this.$emit("problem-solved");
    },

    async acceptRules() {
      this.acceptingRules = true;

      try {
        const rulesKey = `contest_rules_${this.contestId}_${this.problemId}`;
        localStorage.setItem(rulesKey, "accepted");
        this.showRulesModal = false;

        await this.enterFullscreen();
        this.startMonitoring();
      } finally {
        this.acceptingRules = false;
      }
    },

    declineRules() {
      this.showRulesModal = false;
      this.$emit("anti-cheat-declined");
    },

    async enterFullscreen() {
      try {
        const elem = document.documentElement; // Check if already in fullscreen

        if (
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement ||
          document.mozFullScreenElement
        ) {
          this.isFullscreen = true;
          return; // Already in fullscreen
        }

        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
          await elem.msRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
          await elem.mozRequestFullScreen();
        } else {
          throw new Error("Fullscreen not supported");
        }
      } catch (error) {
        console.warn("Fullscreen request failed:", error); // Only record violation if this is not the initial attempt
        if (this.hasEnteredFullscreenBefore) {
          this.recordViolation("Failed to enter fullscreen mode");
        }
      }
    },

    startMonitoring() {
      if (this.isMonitoring || this.problemSolved) return;

      this.isMonitoring = true;
      this.setupEventListeners();

      // Check fullscreen status periodically
      this.fullscreenCheckInterval = setInterval(() => {
        this.checkFullscreenStatus();
      }, 1000);

      // Check for developer tools
      this.devToolsCheckInterval = setInterval(() => {
        this.checkDevTools();
      }, 2000);

      console.log("Anti-cheat monitoring started for problem:", this.problemId);
    },

    setupEventListeners() {
      // Fullscreen change detection
      document.addEventListener(
        "fullscreenchange",
        this.handleFullscreenChange
      );
      document.addEventListener(
        "webkitfullscreenchange",
        this.handleFullscreenChange
      );
      document.addEventListener(
        "msfullscreenchange",
        this.handleFullscreenChange
      );
      document.addEventListener(
        "mozfullscreenchange",
        this.handleFullscreenChange
      );

      // Tab visibility change
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );
      this.visibilityListenerActive = true;

      // Keyboard shortcuts detection
      document.addEventListener("keydown", this.handleKeyDown);
      this.keyboardListenerActive = true;

      // Mouse events (for detecting clicks outside)
      document.addEventListener("blur", this.handleWindowBlur);
      document.addEventListener("focus", this.handleWindowFocus);

      // Context menu (right-click) prevention
      document.addEventListener("contextmenu", this.handleContextMenu);
      this.contextMenuListenerActive = true;

      // Window resize (potential dev tools detection)
      window.addEventListener("resize", this.handleWindowResize);

      // Before unload detection
      window.addEventListener("beforeunload", this.handleBeforeUnload);
    },

    handleFullscreenChange() {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement
      ); // Check for a violation: // - The component thought it was in fullscreen (this.isFullscreen). // - The browser reports it is NOT in fullscreen anymore (!isCurrentlyFullscreen). // - Monitoring is active and the problem is not solved. // - Crucially, the user has successfully entered fullscreen at least once before (this.hasEnteredFullscreenBefore).

      if (
        this.isFullscreen &&
        !isCurrentlyFullscreen &&
        this.isMonitoring &&
        !this.problemSolved &&
        this.hasEnteredFullscreenBefore
      ) {
        this.recordViolation("Exited fullscreen mode"); // Try to re-enter fullscreen after a short delay

        setTimeout(() => {
          if (!this.problemSolved) {
            this.enterFullscreen();
          }
        }, 100);
      } // Update the component's state to match the browser's actual state

      this.isFullscreen = isCurrentlyFullscreen; // Set the flag once we successfully enter fullscreen for the first time. // This ensures the initial entry does not cause a violation.

      if (isCurrentlyFullscreen && !this.hasEnteredFullscreenBefore) {
        this.hasEnteredFullscreenBefore = true;
      }
    },

    handleVisibilityChange() {
      if (document.hidden && this.isMonitoring && !this.problemSolved) {
        this.recordViolation("Switched to another tab/window");
      }
    },

    handleKeyDown(event) {
      if (!this.isMonitoring || this.problemSolved) return;

      const forbiddenKeys = [
        // Developer tools
        { key: "F12" },
        { key: "I", ctrl: true, shift: true }, // Chrome DevTools
        { key: "J", ctrl: true, shift: true }, // Chrome Console
        { key: "C", ctrl: true, shift: true }, // Chrome Inspector
        { key: "U", ctrl: true }, // View Source

        // Tab switching
        { key: "Tab", alt: true },

        // Windows key
        { key: "Meta" },

        // Task manager / System shortcuts
        { key: "Delete", ctrl: true, alt: true },
        { key: "Tab", ctrl: true },
        { key: "Tab", ctrl: true, shift: true },
      ];

      for (let forbidden of forbiddenKeys) {
        if (this.matchesKeyCombo(event, forbidden)) {
          event.preventDefault();
          event.stopPropagation();
          this.recordViolation(
            `Pressed forbidden key combination: ${this.getKeyComboString(
              forbidden
            )}`
          );
          return false;
        }
      }
    },

    matchesKeyCombo(event, combo) {
      return (
        event.key === combo.key &&
        !!event.ctrlKey === !!combo.ctrl &&
        !!event.altKey === !!combo.alt &&
        !!event.shiftKey === !!combo.shift
      );
    },

    getKeyComboString(combo) {
      let parts = [];
      if (combo.ctrl) parts.push("Ctrl");
      if (combo.alt) parts.push("Alt");
      if (combo.shift) parts.push("Shift");
      parts.push(combo.key);
      return parts.join("+");
    },

    handleWindowBlur() {
      if (this.isMonitoring && !this.problemSolved) {
        this.recordViolation("Window lost focus");
      }
    },

    handleWindowFocus() {
      // Window regained focus - check if we're still in fullscreen
      if (this.isMonitoring && !this.isFullscreen && !this.problemSolved) {
        this.enterFullscreen();
      }
    },

    handleContextMenu(event) {
      if (this.isMonitoring && !this.problemSolved) {
        event.preventDefault();
        this.recordViolation("Attempted to open context menu");
        return false;
      }
    },

    handleWindowResize() {
      // Detect potential developer tools opening
      const heightDiff = Math.abs(window.innerHeight - this.lastWindowHeight);
      const widthDiff = Math.abs(window.innerWidth - this.lastWindowWidth);

      if (
        (heightDiff > 100 || widthDiff > 100) &&
        this.isMonitoring &&
        !this.problemSolved
      ) {
        this.recordViolation(
          "Significant window resize detected (possible dev tools)"
        );
      }

      this.lastWindowHeight = window.innerHeight;
      this.lastWindowWidth = window.innerWidth;
    },

    handleBeforeUnload(event) {
      if (this.isMonitoring && !this.problemSolved) {
        this.recordViolation("Attempted to leave the page");
        event.preventDefault();
        event.returnValue =
          "Are you sure you want to leave? This will be recorded as a violation.";
      }
    },

    checkFullscreenStatus() {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement
      );

      if (
        !isCurrentlyFullscreen &&
        this.isMonitoring &&
        this.isFullscreen &&
        !this.problemSolved
      ) {
        this.handleFullscreenChange();
      }
    },

    checkDevTools() {
      if (this.problemSolved) return;

      // Method 1: Check for console.log performance
      const startTime = performance.now();
      console.log("%c", "color: transparent;");
      const endTime = performance.now();

      if (endTime - startTime > 100) {
        if (!this.devToolsOpen) {
          this.devToolsOpen = true;
          this.recordViolation("Developer tools opened");
        }
      } else {
        this.devToolsOpen = false;
      }

      // Method 2: Check window size vs screen size
      const threshold = 160;
      if (
        window.outerHeight - window.innerHeight > threshold ||
        window.outerWidth - window.innerWidth > threshold
      ) {
        if (!this.devToolsOpen) {
          this.devToolsOpen = true;
          this.recordViolation(
            "Developer tools detected (window size analysis)"
          );
        }
      }
    },

    recordViolation(violationType) {
      if (this.problemSolved) {
        console.log(
          "Problem already solved, ignoring violation:",
          violationType
        );
        return;
      }

      console.log(
        `Recording violation for problem ${this.problemId}: ${violationType}`
      );

      // Convert problem ID to string for consistency
      const problemIdStr = String(this.problemId);

      // Check cooldown for this specific problem and violation type
      const cooldownKey = `last_violation_${this.contestId}_${problemIdStr}_${violationType}`;
      const lastViolationTime = localStorage.getItem(cooldownKey);
      const now = Date.now();

      if (lastViolationTime && now - parseInt(lastViolationTime) < 15000) {
        console.log(
          `Violation type ${violationType} for problem ${problemIdStr} in cooldown period, ignoring`
        );
        return;
      }

      // Update problem-specific violation count (not total)
      this.problemViolationCount++;
      this.violationCount = this.problemViolationCount; // Display problem-specific count only
      this.lastViolation = violationType;

      // Send to backend
      this.sendViolationToBackend(violationType);
      this.showWarningModalWithTimer();

      console.warn(
        `Anti-cheat violation #${this.problemViolationCount} for problem ${problemIdStr}: ${violationType}`
      );
    },

    showWarningModalWithTimer() {
      this.showWarningModal = true;
      this.canCloseModal = false;
      this.modalCountdown = 15;

      // Clear any existing timer
      if (this.modalCloseTimer) {
        clearInterval(this.modalCloseTimer);
      }

      // Start countdown timer
      this.modalCloseTimer = setInterval(() => {
        this.modalCountdown--;

        if (this.modalCountdown <= 0) {
          this.canCloseModal = true;
          clearInterval(this.modalCloseTimer);
          this.modalCloseTimer = null;
        }
      }, 1000);
    },

    async sendViolationToBackend(violationType) {
      const violationKey = `${violationType}_${Date.now()}`;
      if (this.pendingViolations.has(violationKey)) {
        console.log("Duplicate violation request prevented:", violationType);
        return;
      }

      this.pendingViolations.add(violationKey);

      try {
        // FIXED: Ensure problem ID is properly converted to string
        const problemIdStr = String(this.problemId);

        const violationData = {
          contest_id: String(this.contestId),
          problem_id: problemIdStr, // Always include for problem-specific tracking
          violation_type: this.mapViolationType(violationType),
          violation_details: String(violationType),
          timestamp: new Date().toISOString(),
        };

        console.log("Sending violation to backend:", violationData);

        const response = await api.reportAntiCheatViolation(violationData);

        if (response && response.data) {
          const responseData = response.data.data || {};

          // FIXED: Update only THIS problem's violation count
          if (responseData.problem_violation_count !== undefined) {
            this.problemViolationCount = responseData.problem_violation_count;
            this.violationCount = this.problemViolationCount; // Only show this problem's count
          }

          // Store cooldown timestamp for this specific problem
          const cooldownKey = `last_violation_${this.contestId}_${problemIdStr}_${violationType}`;
          localStorage.setItem(cooldownKey, Date.now().toString());

          console.log(
            `Violation recorded for problem ${problemIdStr}. Count: ${
              this.problemViolationCount
            }, Penalty: ${this.problemViolationCount * 10} minutes`
          );

          // Emit to parent component with problem-specific data
          this.$emit("violation-recorded", {
            count: this.problemViolationCount,
            penalty: this.problemViolationCount * 10,
            type: violationType,
            problemId: problemIdStr,
          });
        }
      } catch (error) {
        console.error("Failed to send violation to backend:", error);

        // Show user-friendly error message
        if (error.isApiError && error.message.includes("Problem not found")) {
          this.$Message.error({
            content: `Problem ${this.problemId} not found in contest. Stopping anti-cheat monitoring.`,
            duration: 8,
          });
          this.stopMonitoring();
          this.$emit("anti-cheat-declined");
        }
      } finally {
        setTimeout(() => {
          this.pendingViolations.delete(violationKey);
        }, 2000);
      }
    },

    mapViolationType(violationType) {
      const typeMap = {
        "Exited fullscreen mode": "fullscreen_exit",
        "Switched to another tab/window": "tab_switch",
        "Developer tools opened": "dev_tools",
        "Developer tools detected": "dev_tools",
        "Pressed forbidden key combination": "forbidden_keys",
        "Attempted to open context menu": "context_menu",
        "Window lost focus": "window_blur",
        "Attempted to leave the page": "page_leave",
        "Significant window resize detected": "window_resize",
        "Failed to enter fullscreen mode": "fullscreen_exit",
      };

      for (let key in typeMap) {
        if (violationType.includes(key)) {
          return typeMap[key];
        }
      }
      return "other"; // default fallback
    },

    acknowledgeWarning() {
      if (!this.canCloseModal) {
        // Prevent closing if countdown hasn't finished
        this.$Message.warning({
          content: `Please wait ${this.modalCountdown} seconds before continuing`,
          duration: 2,
        });
        return;
      }

      this.showWarningModal = false;

      // Clear timer if it exists
      if (this.modalCloseTimer) {
        clearInterval(this.modalCloseTimer);
        this.modalCloseTimer = null;
      }

      // Try to re-enter fullscreen if not already
      if (!this.isFullscreen && !this.problemSolved) {
        this.enterFullscreen();
      }
    },

    stopMonitoring() {
      this.isMonitoring = false;
      this.cleanup();
    },

    cleanup() {
      // Clear intervals
      if (this.fullscreenCheckInterval) {
        clearInterval(this.fullscreenCheckInterval);
      }
      if (this.devToolsCheckInterval) {
        clearInterval(this.devToolsCheckInterval);
      }
      if (this.modalCloseTimer) {
        clearInterval(this.modalCloseTimer);
        this.modalCloseTimer = null;
      }

      // Remove event listeners
      document.removeEventListener(
        "fullscreenchange",
        this.handleFullscreenChange
      );
      document.removeEventListener(
        "webkitfullscreenchange",
        this.handleFullscreenChange
      );
      document.removeEventListener(
        "msfullscreenchange",
        this.handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        this.handleFullscreenChange
      );

      if (this.visibilityListenerActive) {
        document.removeEventListener(
          "visibilitychange",
          this.handleVisibilityChange
        );
      }

      if (this.keyboardListenerActive) {
        document.removeEventListener("keydown", this.handleKeyDown);
      }

      if (this.contextMenuListenerActive) {
        document.removeEventListener("contextmenu", this.handleContextMenu);
      }

      document.removeEventListener("blur", this.handleWindowBlur);
      document.removeEventListener("focus", this.handleWindowFocus);
      window.removeEventListener("resize", this.handleWindowResize);
      window.removeEventListener("beforeunload", this.handleBeforeUnload);

      // Exit fullscreen if we're still in it
      if (this.isFullscreen) {
        try {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          }
        } catch (error) {
          console.warn("Failed to exit fullscreen:", error);
        }
      }

      // Clear pending violations and reset flags
      this.pendingViolations.clear();
      this.hasEnteredFullscreenBefore = false; // Reset the flag

      console.log("Anti-cheat monitoring stopped");
    },
  },

  watch: {
    contestId: {
      handler(newId, oldId) {
        if (newId !== oldId && newId) {
          console.log(`Contest ID changed from ${oldId} to ${newId}`);
          this.cleanup();
          if (this.isActive) {
            this.$nextTick(() => {
              this.initializeAntiCheat();
            });
          }
        }
      },
      immediate: false,
    },

    problemId: {
      handler(newId, oldId) {
        if (newId !== oldId && newId) {
          console.log(`Problem ID changed from ${oldId} to ${newId}`);
          this.cleanup();
          this.problemSolved = false;
          if (this.isActive && this.contestId) {
            this.$nextTick(() => {
              this.initializeAntiCheat();
            });
          }
        }
      },
      immediate: false,
    },

    isActive: {
      handler(newVal) {
        console.log(`Anti-cheat active status changed to: ${newVal}`);
        if (newVal && this.contestId && this.problemId) {
          this.$nextTick(() => {
            this.initializeAntiCheat();
          });
        } else {
          this.stopMonitoring();
        }
      },
      immediate: true,
    },

    // Watch for problem status changes from parent
    problemStatus: {
      handler(newStatus) {
        if (newStatus === 0) {
          console.log("Problem status indicates solved - stopping monitoring");
          this.problemSolved = true;
          this.stopMonitoring();
          this.$emit("problem-solved");
        }
      },
      immediate: true,
    },
  },
};
</script>

<style lang="less" scoped>
.anti-cheat-modal,
.cheat-warning-modal {
  .rules-content {
    padding: 20px 0;

    h3 {
      color: #2d8cf0;
      margin-bottom: 15px;
    }

    ul {
      margin: 15px 0;
      padding-left: 20px;

      li {
        margin: 8px 0;
        line-height: 1.5;
      }
    }

    .current-penalty {
      background: #fff2e8;
      border: 1px solid #ed4014;
      border-radius: 4px;
      padding: 12px;
      margin: 15px 0;

      span {
        margin-left: 8px;
        color: #ed4014;
        font-weight: 600;
      }
    }

    .warning-box {
      background: #f0f9ff;
      border: 1px solid #2d8cf0;
      border-radius: 4px;
      padding: 12px;
      margin-top: 20px;

      span {
        margin-left: 8px;
        color: #2d8cf0;
      }
    }
  }

  .warning-content {
    padding: 20px 0;

    p {
      margin: 10px 0;
      font-size: 14px;

      strong {
        color: #495060;
      }
    }

    .countdown-warning {
      background: #f0f9ff;
      border: 1px solid #2d8cf0;
      border-radius: 4px;
      padding: 12px;
      margin-top: 15px;
      text-align: center;

      span {
        margin-left: 8px;
        color: #2d8cf0;
        font-weight: 600;
      }
    }

    .countdown-bar {
      width: 100%;
      height: 4px;
      background-color: #e8e8e8;
      border-radius: 2px;
      margin-top: 8px;
      overflow: hidden;
    }

    .countdown-progress {
      height: 100%;
      background: linear-gradient(90deg, #2d8cf0, #19be6b);
      border-radius: 2px;
      transition: width 1s ease;
    }

    .violation-warning {
      background: #fff6f0;
      border: 1px solid #ff9900;
      border-radius: 4px;
      padding: 12px;
      margin-top: 15px;

      span {
        margin-left: 8px;
        color: #ff9900;
      }
    }
  }
}
</style>
