<template>
  <div>
    <Modal
      v-model="showRulesModal"
      :closable="false"
      :mask-closable="false"
      width="600"
      class-name="anti-cheat-modal"
    >
      <div slot="header">
        <Icon type="alert" style="color: #ff9900"></Icon>
        <span style="margin-left: 8px; font-weight: bold">Contest Anti-Cheat System</span>
      </div>

      <div class="rules-content">
        <h3>Contest Rules & Anti-Cheat Policy</h3>
        <ul>
          <li>You must remain in fullscreen mode throughout the contest</li>
          <li>Switching tabs, minimizing window, or opening developer tools is prohibited</li>
          <li>Any attempt to exit fullscreen will be detected and logged</li>
          <li>Each violation will add 10 minutes penalty to your submission time</li>
          <li>Multiple violations may result in disqualification</li>
        </ul>

        <div v-if="violationCount > 0" class="current-penalty">
          <Icon type="information-circled" style="color: #ed4014"></Icon>
          <span>You currently have {{ violationCount }} violations ({{ violationCount * 10 }} minutes penalty)</span>
        </div>

        <div class="warning-box">
          <Icon type="information-circled" style="color: #2d8cf0"></Icon>
          <span>By accepting, you agree to follow these rules and understand the consequences of violations.</span>
        </div>
      </div>

      <div slot="footer">
        <Button @click="declineRules" style="margin-right: 8px">Go Back</Button>
        <Button type="primary" @click="acceptRules" :loading="acceptingRules">Accept & Continue</Button>
      </div>
    </Modal>

    <Modal
      v-model="showWarningModal"
      :closable="false"
      :mask-closable="false"
      width="500"
      class-name="cheat-warning-modal"
      :z-index="99999"
      :append-to-body="true"
      :transfer="false"
      :lock-scroll="true"
      :mask="true"
    >
      <div slot="header" style="color: #ed4014">
        <Icon type="alert" style="color: #ed4014"></Icon>
        <span style="margin-left: 8px; font-weight: bold">Cheating Detected!</span>
      </div>

      <div class="warning-content">
        <p><strong>Violation:</strong> {{ lastViolation }}</p>
        <p><strong>Total Violations for this Problem:</strong> {{ violationCount }}</p>
        <p><strong>Penalty:</strong> +10 minutes will be added to your next correct submission for this problem</p>

        <div class="violation-warning">
          <Icon type="ios-warning" style="color: #ff9900"></Icon>
          <span>Please return to fullscreen mode and avoid further violations.</span>
        </div>

        <div v-if="!canCloseModal" class="countdown-warning">
          <Icon type="ios-time" style="color: #2d8cf0"></Icon>
          <span>You must wait {{ modalCountdown }} seconds before continuing...</span>
          <div class="countdown-bar">
            <div class="countdown-progress" :style="{ width: `${((15 - modalCountdown) / 15) * 100}%` }"></div>
          </div>
        </div>
      </div>

      <div slot="footer">
        <Button type="primary" @click="acknowledgeWarning" :disabled="!canCloseModal" :loading="!canCloseModal">
          <span v-if="canCloseModal">I Understand</span>
          <span v-else>Wait {{ modalCountdown }}s</span>
        </Button>
      </div>
    </Modal>

    <Modal
      v-model="showTimeLimitModal"
      :closable="false"
      :mask-closable="false"
      width="450"
      class-name="time-limit-modal"
      :z-index="100000"
      :append-to-body="true"
      :transfer="false"
    >
      <div slot="header">
        <Icon type="ios-time-outline"></Icon>
        <span>Session Time Limit</span>
      </div>
      <div class="time-limit-content">
        <p>Your session has expired.</p>
        <p>Would you like to continue or leave the problem?</p>
      </div>
      <div slot="footer">
        <Button @click="leaveSession" type="text">Leave Now</Button>
        <Button type="primary" @click="extendSession">Continue (Add 30 mins)</Button>
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
    problemStatus: {
      type: Number,
      default: null,
    },
    sessionDuration: {
      type: Number,
      default: 1800,
    },
  },

  data() {
    return {
      // Modal states
      showRulesModal: false,
      showWarningModal: false,
      showTimeLimitModal: false,
      acceptingRules: false,
      canCloseModal: false,
      modalCountdown: 15,
      
      // Monitoring states
      isMonitoring: false,
      rulesAccepted: false,
      shouldActivate: false,
      
      // Fullscreen tracking
      isFullscreen: false,
      hasEnteredFullscreenBefore: false,
      isTransitioningToFullscreen: false,
      
      // Violation tracking with improved debouncing
      violationCount: 0,
      problemViolationCount: 0,
      lastViolation: "",
      pendingViolations: new Set(),
      violationCooldowns: new Map(), // Track cooldowns per violation type
      
      // Problem state
      problemSolved: false,
      
      // Enhanced window/tab focus detection
      windowHasFocus: true,
      windowBlurStartTime: 0,
      isInViolationState: false, // Prevent overlapping violations
      lastViolationType: null,
      lastViolationTime: 0,
      
      // Developer tools detection
      devToolsOpen: false,
      lastWindowHeight: window.innerHeight,
      lastWindowWidth: window.innerWidth,
      
      // Session management
      sessionTimer: null,
      timeRemaining: this.sessionDuration,
      isLeaving: false,
      
      // Timers and intervals
      modalCloseTimer: null,
      fullscreenCheckInterval: null,
      devToolsCheckInterval: null,
      fullscreenTransitionTimeout: null,
      forceModalUpdateInterval: null,
      
      // Violation debouncing constants
      VIOLATION_COOLDOWN_MS: 10000, // 10 seconds between same violation types
      VIOLATION_GROUPING_MS: 2000,  // 2 seconds to group similar violations
      MAX_VIOLATIONS_PER_MINUTE: 3, // Maximum violations per minute
    };
  },

  mounted() {
    if (this.isActive && this.contestId && this.problemId) {
      this.$nextTick(() => {
        this.initializeAntiCheat();
      });
    }
  },

  beforeDestroy() {
    this.cleanup();
  },

  methods: {
    // Initialize anti-cheat system
    async initializeAntiCheat() {
      if (!this.problemId || this.problemId === "undefined" || this.problemId === "" || this.problemId === null) {
        this.$emit("anti-cheat-declined");
        return;
      }

      const problemIdStr = String(this.problemId);

      // Check existing violation status
      try {
        const statusRes = await api.checkProblemAntiCheatStatus(this.contestId, problemIdStr);
        if (statusRes && statusRes.data && statusRes.data.data) {
          const data = statusRes.data.data;
          this.problemViolationCount = data.problem_violation_count || 0;
          this.violationCount = this.problemViolationCount;

          if (data.problem_solved) {
            this.$emit("problem-solved");
            return;
          }

          if (this.problemViolationCount > 0) {
            this.$Message.info({
              content: `This problem has ${this.problemViolationCount} violations (${this.problemViolationCount * 10} minutes penalty)`,
              duration: 6,
            });
          }
        }
      } catch (error) {
        this.problemViolationCount = 0;
        this.violationCount = 0;
      }

      // Check if rules were previously accepted
      const rulesKey = `contest_rules_${this.contestId}_${problemIdStr}`;
      const rulesAccepted = localStorage.getItem(rulesKey);

      if (!rulesAccepted) {
        this.shouldActivate = true;
        this.showRulesModal = true;
      } else {
        this.rulesAccepted = true;
        this.shouldActivate = true;
        this.notifyParentActivation();
        this.startMonitoring();
      }
    },

    notifyParentActivation() {
      if (this.shouldActivate && this.rulesAccepted) {
        this.$emit("anti-cheat-activated", true);
      }
    },

    // Accept contest rules and start monitoring
    async acceptRules() {
      this.acceptingRules = true;

      try {
        const rulesKey = `contest_rules_${this.contestId}_${this.problemId}`;
        localStorage.setItem(rulesKey, "accepted");

        this.rulesAccepted = true;
        this.showRulesModal = false;
        this.notifyParentActivation();

        await this.enterFullscreen();
        this.startMonitoring();
      } finally {
        this.acceptingRules = false;
      }
    },

    declineRules() {
      this.showRulesModal = false;
      this.shouldActivate = false;
      this.rulesAccepted = false;
      this.$emit("anti-cheat-declined");
    },

    // Problem solved - cleanup monitoring
    onProblemSolved() {
      const rulesKey = `contest_rules_${this.contestId}_${this.problemId}`;
      localStorage.removeItem(rulesKey);

      this.stopMonitoring();
      this.problemSolved = true;

      this.$Message.success({
        content: "Anti-cheat monitoring disabled for this solved problem.",
        duration: 5,
      });

      this.$emit("problem-solved");
    },

    // Enter fullscreen mode
    async enterFullscreen() {
      try {
        const elem = document.documentElement;

        if (document.fullscreenElement || document.webkitFullscreenElement || 
            document.msFullscreenElement || document.mozFullScreenElement) {
          this.isFullscreen = true;
          return;
        }

        this.isTransitioningToFullscreen = true;

        if (this.fullscreenTransitionTimeout) {
          clearTimeout(this.fullscreenTransitionTimeout);
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

        this.fullscreenTransitionTimeout = setTimeout(() => {
          this.isTransitioningToFullscreen = false;
        }, 3000);
      } catch (error) {
        this.isTransitioningToFullscreen = false;
        if (this.fullscreenTransitionTimeout) {
          clearTimeout(this.fullscreenTransitionTimeout);
          this.fullscreenTransitionTimeout = null;
        }

        if (this.hasEnteredFullscreenBefore && !this.isInViolationState) {
          this.recordViolation("Failed to enter fullscreen mode");
        }
      }
    },

    // Start monitoring for cheating behaviors
    startMonitoring() {
      if (this.isMonitoring || this.problemSolved) return;

      this.isMonitoring = true;
      this.setupEventListeners();
      this.startSessionTimer();

      // Periodic checks for fullscreen and dev tools
      this.fullscreenCheckInterval = setInterval(() => {
        this.checkFullscreenStatus();
      }, 2000); // Reduced frequency

      this.devToolsCheckInterval = setInterval(() => {
        this.checkDevTools();
      }, 3000); // Reduced frequency
    },

    stopMonitoring() {
      this.isMonitoring = false;
      this.cleanup();
    },

    // Setup event listeners for cheat detection
    setupEventListeners() {
      // Fullscreen change detection
      document.addEventListener("fullscreenchange", this.handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", this.handleFullscreenChange);
      document.addEventListener("msfullscreenchange", this.handleFullscreenChange);
      document.addEventListener("mozfullscreenchange", this.handleFullscreenChange);

      // Tab/window switching detection with improved handling
      document.addEventListener("visibilitychange", this.handleVisibilityChange);
      window.addEventListener("blur", this.handleWindowBlur);
      window.addEventListener("focus", this.handleWindowFocus);

      // Developer tools and forbidden key detection
      document.addEventListener("keydown", this.handleKeyDown);
      document.addEventListener("contextmenu", this.handleContextMenu);

      // Window manipulation detection
      window.addEventListener("resize", this.handleWindowResize);
      window.addEventListener("beforeunload", this.handleBeforeUnload);
    },

    // Improved violation checking with debouncing
    canRecordViolation(violationType) {
      if (this.problemSolved || this.isInViolationState) return false;
      
      const now = Date.now();
      const cooldownKey = `${violationType}_${this.contestId}_${this.problemId}`;
      
      // Check if we're in cooldown period for this violation type
      if (this.violationCooldowns.has(cooldownKey)) {
        const lastTime = this.violationCooldowns.get(cooldownKey);
        if (now - lastTime < this.VIOLATION_COOLDOWN_MS) {
          return false;
        }
      }
      
      // Check if this is the same violation type as the last one within grouping period
      if (this.lastViolationType === violationType && 
          now - this.lastViolationTime < this.VIOLATION_GROUPING_MS) {
        return false;
      }
      
      // Rate limiting: max violations per minute
      const recentViolations = Array.from(this.violationCooldowns.values())
        .filter(time => now - time < 60000).length;
      
      if (recentViolations >= this.MAX_VIOLATIONS_PER_MINUTE) {
        return false;
      }
      
      return true;
    },

    // Fullscreen change handler with improved logic
    handleFullscreenChange() {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement
      );

      // Record violation if user exits fullscreen after initial entry
      if (this.isFullscreen === true && isCurrentlyFullscreen === false && 
          this.hasEnteredFullscreenBefore && this.isMonitoring && 
          !this.problemSolved && !this.isTransitioningToFullscreen) {
        
        if (this.canRecordViolation("fullscreen_exit")) {
          this.recordViolation("Exited fullscreen mode");
        }

        // Re-enter fullscreen after a short delay
        setTimeout(() => {
          if (!this.problemSolved && !this.isInViolationState) {
            this.enterFullscreen();
          }
        }, 1000);
      }

      this.isFullscreen = isCurrentlyFullscreen;

      if (isCurrentlyFullscreen && !this.hasEnteredFullscreenBefore) {
        this.hasEnteredFullscreenBefore = true;
      }

      if (isCurrentlyFullscreen && this.isTransitioningToFullscreen) {
        if (this.fullscreenTransitionTimeout) {
          clearTimeout(this.fullscreenTransitionTimeout);
        }
        this.fullscreenTransitionTimeout = setTimeout(() => {
          this.isTransitioningToFullscreen = false;
        }, 2000);
      }
    },

    // Improved page visibility change detection
    handleVisibilityChange() {
      if (!this.isMonitoring || this.problemSolved || this.isInViolationState) return;

      if (document.hidden && this.canRecordViolation("tab_switch")) {
        this.recordViolation("Tab switched or window minimized");
      }
    },

    // Enhanced window focus handling
    handleWindowBlur() {
      if (!this.isMonitoring || this.problemSolved) return;

      this.windowBlurStartTime = Date.now();
      this.windowHasFocus = false;

      // Only record violation after a meaningful blur duration
      setTimeout(() => {
        if (!this.windowHasFocus && this.isMonitoring && !this.problemSolved && 
            !this.isInViolationState && this.canRecordViolation("window_blur")) {
          const blurDuration = Date.now() - this.windowBlurStartTime;
          if (blurDuration > 500) { // Only if blur lasted more than 500ms
            this.recordViolation("Window lost focus (task switching detected)");
          }
        }
      }, 1000); // Wait 1 second before recording violation
    },

    handleWindowFocus() {
      if (!this.isMonitoring || this.problemSolved) return;

      this.windowHasFocus = true;
      this.windowBlurStartTime = 0;

      // Re-enter fullscreen if needed
      if (!this.isFullscreen && !this.problemSolved && !this.isInViolationState) {
        setTimeout(() => {
          this.enterFullscreen();
        }, 500);
      }
    },

    // Keyboard event detection with improved handling
    handleKeyDown(event) {
      if (!this.isMonitoring || this.problemSolved || this.isInViolationState) return;

      const forbiddenKeys = [
        { key: "F12" },
        { key: "I", ctrl: true, shift: true },
        { key: "J", ctrl: true, shift: true },
        { key: "C", ctrl: true, shift: true },
        { key: "U", ctrl: true },
      ];

      for (let forbidden of forbiddenKeys) {
        if (this.matchesKeyCombo(event, forbidden) && 
            this.canRecordViolation("forbidden_keys")) {
          event.preventDefault();
          event.stopPropagation();
          this.recordViolation(`Pressed forbidden key combination: ${this.getKeyComboString(forbidden)}`);
          return false;
        }
      }
    },

    // Context menu prevention
    handleContextMenu(event) {
      if (this.isMonitoring && !this.problemSolved && !this.isInViolationState) {
        event.preventDefault();
        if (this.canRecordViolation("context_menu")) {
          this.recordViolation("Attempted to open context menu");
        }
        return false;
      }
    },

    // Window resize detection with improved logic
    handleWindowResize() {
      if (this.isTransitioningToFullscreen || this.isInViolationState) {
        this.lastWindowHeight = window.innerHeight;
        this.lastWindowWidth = window.innerWidth;
        return;
      }

      const heightDiff = Math.abs(window.innerHeight - this.lastWindowHeight);
      const widthDiff = Math.abs(window.innerWidth - this.lastWindowWidth);

      if ((heightDiff > 150 || widthDiff > 150) && this.isMonitoring && 
          !this.problemSolved && this.isFullscreen && this.hasEnteredFullscreenBefore &&
          this.canRecordViolation("window_resize")) {
        this.recordViolation("Significant window resize detected (possible dev tools)");
      }

      this.lastWindowHeight = window.innerHeight;
      this.lastWindowWidth = window.innerWidth;
    },

    // Page navigation detection
    handleBeforeUnload(event) {
      if (this.isMonitoring && !this.problemSolved && !this.isLeaving && 
          this.canRecordViolation("page_leave")) {
        this.recordViolation("Attempted to leave the page");
      }
    },

    // Periodic fullscreen status check
    checkFullscreenStatus() {
      if (this.isInViolationState || this.problemSolved) return;

      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement
      );

      if (!isCurrentlyFullscreen && this.isMonitoring && this.isFullscreen && 
          !this.isTransitioningToFullscreen) {
        this.handleFullscreenChange();
      }
    },

    // Developer tools detection with improved accuracy
    checkDevTools() {
      if (this.problemSolved || this.isInViolationState) return;

      // Console timing detection
      const startTime = performance.now();
      console.log("%c", "color: transparent;");
      const endTime = performance.now();

      const wasDevToolsOpen = this.devToolsOpen;
      
      if (endTime - startTime > 100) {
        this.devToolsOpen = true;
        if (!wasDevToolsOpen && this.canRecordViolation("dev_tools")) {
          this.recordViolation("Developer tools opened");
        }
      } else {
        this.devToolsOpen = false;
      }

      // Window size analysis with improved threshold
      const threshold = 200;
      if (window.outerHeight - window.innerHeight > threshold || 
          window.outerWidth - window.innerWidth > threshold) {
        if (!this.devToolsOpen && this.canRecordViolation("dev_tools_size")) {
          this.devToolsOpen = true;
          this.recordViolation("Developer tools detected (window size analysis)");
        }
      }
    },

    // Session timer management
    startSessionTimer() {
      if (this.sessionTimer) clearInterval(this.sessionTimer);
      this.sessionTimer = setInterval(() => {
        this.timeRemaining--;
        this.$emit("time-update", this.timeRemaining);

        if (this.timeRemaining <= 0) {
          clearInterval(this.sessionTimer);
          this.sessionTimer = null;
          this.showTimeLimitModal = true;
        }
      }, 1000);
    },

    stopSessionTimer() {
      if (this.sessionTimer) {
        clearInterval(this.sessionTimer);
        this.sessionTimer = null;
      }
    },

    extendSession() {
      this.showTimeLimitModal = false;
      this.timeRemaining = this.sessionDuration;
      this.startSessionTimer();
    },

    leaveSession() {
      this.isLeaving = true;
      this.stopSessionTimer();
      this.$emit("leave-contest");
    },

    // Improved violation recording with proper state management
    recordViolation(violationType) {
      if (this.problemSolved || this.isInViolationState) return;

      const now = Date.now();
      const cooldownKey = `${violationType}_${this.contestId}_${this.problemId}`;
      
      // Set violation state to prevent overlapping
      this.isInViolationState = true;
      
      // Update violation tracking
      this.violationCooldowns.set(cooldownKey, now);
      this.lastViolationType = violationType;
      this.lastViolationTime = now;
      
      this.problemViolationCount++;
      this.violationCount = this.problemViolationCount;
      this.lastViolation = violationType;

      this.sendViolationToBackend(violationType);
      this.showWarningModalWithTimer();
    },

    // Show warning modal with countdown
    showWarningModalWithTimer() {
      // Close any existing modal first
      this.showWarningModal = false;

      this.$nextTick(() => {
        this.showWarningModal = true;
        this.canCloseModal = false;
        this.modalCountdown = 15;
      });

      if (this.modalCloseTimer) {
        clearInterval(this.modalCloseTimer);
      }

      this.modalCloseTimer = setInterval(() => {
        this.modalCountdown--;
        if (this.modalCountdown <= 0) {
          this.canCloseModal = true;
          clearInterval(this.modalCloseTimer);
          this.modalCloseTimer = null;
        }
      }, 1000);
    },

    // Send violation data to backend
    async sendViolationToBackend(violationType) {
      const violationKey = `${violationType}_${Date.now()}`;
      if (this.pendingViolations.has(violationKey)) return;

      this.pendingViolations.add(violationKey);

      try {
        const problemIdStr = String(this.problemId);
        const violationData = {
          contest_id: String(this.contestId),
          problem_id: problemIdStr,
          violation_type: this.mapViolationType(violationType),
          violation_details: String(violationType),
          timestamp: new Date().toISOString(),
        };

        const response = await api.reportAntiCheatViolation(violationData);

        if (response && response.data) {
          const responseData = response.data.data || {};
          if (responseData.problem_violation_count !== undefined) {
            this.problemViolationCount = responseData.problem_violation_count;
            this.violationCount = this.problemViolationCount;
          }

          this.$emit("violation-recorded", {
            count: this.problemViolationCount,
            penalty: this.problemViolationCount * 10,
            type: violationType,
            problemId: problemIdStr,
          });
        }
      } catch (error) {
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

    // Map violation types for backend
    mapViolationType(violationType) {
      const typeMap = {
        "Exited fullscreen mode": "fullscreen_exit",
        "Tab switched or window minimized": "tab_switch",
        "Window lost focus": "window_blur",
        "Developer tools opened": "dev_tools",
        "Pressed forbidden key combination": "forbidden_keys",
        "Attempted to open context menu": "context_menu",
        "Attempted to leave the page": "page_leave",
        "Significant window resize detected": "window_resize",
      };

      for (let key in typeMap) {
        if (violationType.includes(key)) {
          return typeMap[key];
        }
      }
      return "other";
    },

    // Acknowledge violation warning with state reset
    acknowledgeWarning() {
      if (!this.canCloseModal) {
        this.$Message.warning({
          content: `Please wait ${this.modalCountdown} seconds before continuing`,
          duration: 2,
        });
        return;
      }

      this.showWarningModal = false;
      this.isInViolationState = false; // Reset violation state

      if (this.modalCloseTimer) {
        clearInterval(this.modalCloseTimer);
        this.modalCloseTimer = null;
      }

      // Return to fullscreen if needed
      if (!this.isFullscreen && !this.problemSolved) {
        setTimeout(() => {
          this.enterFullscreen();
        }, 500);
      }
    },

    // Helper method to match key combinations
    matchesKeyCombo(event, combo) {
      const keyMatch = event.key === combo.key || event.code === combo.key;
      const ctrlMatch = !!event.ctrlKey === !!combo.ctrl;
      const altMatch = !!event.altKey === !!combo.alt;
      const shiftMatch = !!event.shiftKey === !!combo.shift;
      const metaMatch = !!event.metaKey === !!combo.meta;

      return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
    },

    // Helper method to get key combination string
    getKeyComboString(combo) {
      let parts = [];
      if (combo.ctrl) parts.push("Ctrl");
      if (combo.alt) parts.push("Alt");
      if (combo.shift) parts.push("Shift");
      parts.push(combo.key);
      return parts.join("+");
    },

    // Cleanup all event listeners and timers
    cleanup() {
      // Clear all intervals and timeouts
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
      if (this.fullscreenTransitionTimeout) {
        clearTimeout(this.fullscreenTransitionTimeout);
        this.fullscreenTransitionTimeout = null;
      }

      // Remove all event listeners
      document.removeEventListener("fullscreenchange", this.handleFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", this.handleFullscreenChange);
      document.removeEventListener("msfullscreenchange", this.handleFullscreenChange);
      document.removeEventListener("mozfullscreenchange", this.handleFullscreenChange);
      document.removeEventListener("visibilitychange", this.handleVisibilityChange);
      document.removeEventListener("keydown", this.handleKeyDown);
      document.removeEventListener("contextmenu", this.handleContextMenu);
      
      window.removeEventListener("blur", this.handleWindowBlur);
      window.removeEventListener("focus", this.handleWindowFocus);
      window.removeEventListener("resize", this.handleWindowResize);
      window.removeEventListener("beforeunload", this.handleBeforeUnload);

      // Exit fullscreen if currently in fullscreen
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
          // Ignore exit fullscreen errors during cleanup
        }
      }

      // Stop session timer
      this.stopSessionTimer();

      // Reset component state
      this.$emit("anti-cheat-activated", false);
      this.pendingViolations.clear();
      this.violationCooldowns.clear();
      this.hasEnteredFullscreenBefore = false;
      this.isTransitioningToFullscreen = false;
      this.rulesAccepted = false;
      this.shouldActivate = false;
      this.windowHasFocus = true;
      this.isInViolationState = false;
      this.lastViolationType = null;
      this.lastViolationTime = 0;
    },
  },

  watch: {
    // Watch for contest ID changes
    contestId: {
      handler(newId, oldId) {
        if (newId !== oldId && newId) {
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

    // Watch for problem ID changes
    problemId: {
      handler(newId, oldId) {
        if (newId !== oldId && newId) {
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

    // Watch for active status changes
    isActive: {
      handler(newVal) {
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

    // Watch for problem status changes (solved)
    problemStatus: {
      handler(newStatus) {
        if (newStatus === 0) {
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
.cheat-warning-modal,
.time-limit-modal {
  // Enhanced z-index for violation modal to ensure visibility
  &.cheat-warning-modal {
    z-index: 99999 !important;

    /deep/ .ivu-modal {
      z-index: 99999 !important;
    }

    /deep/ .ivu-modal-mask {
      z-index: 99998 !important;
      background: rgba(0, 0, 0, 0.8) !important;
    }

    /deep/ .ivu-modal-wrap {
      z-index: 99999 !important;
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
    }
  }

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

  .time-limit-content {
    padding: 20px 0;
    text-align: center;

    p {
      margin: 10px 0;
      font-size: 16px;
      color: #495060;
    }
  }
}
</style>