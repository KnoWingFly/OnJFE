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

    <!-- FIXED: Cheat Detection Warning Modal - Always show when triggered -->
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
        <span style="margin-left: 8px; font-weight: bold"
          >Cheating Detected!</span
        >
      </div>

      <div class="warning-content">
        <p><strong>Violation:</strong> {{ lastViolation }}</p>
        <p>
          <strong>Total Violations for this Problem:</strong>
          {{ violationCount }}
        </p>
        <p>
          <strong>Penalty:</strong> +10 minutes will be added to your next
          correct submission for this problem
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
      hasEnteredFullscreenBefore: false,
      problemViolationCount: 0,
      totalViolationCount: 0,
      isTransitioningToFullscreen: false,
      fullscreenTransitionTimeout: null,

      altKeyPressed: false,
      altKeyStartTime: 0,
      windowHasFocus: true,
      windowBlurTime: 0,
      mouseLeftWindow: false,
      mouseLeaveTime: 0,
      pageHiddenTime: 0,

      // Track key combinations more precisely
      pressedKeys: new Set(),
      // NEW: Separate rule acceptance from monitoring
      rulesAccepted: false,
      shouldActivate: false,

      // NEW: Force modal interval
      forceModalUpdateInterval: null,
    };
  },

  mounted() {
    console.log("AntiCheat component mounted", {
      contestId: this.contestId,
      problemId: this.problemId,
      isActive: this.isActive,
    });

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
    // FIXED: Modified initialization
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

      const problemIdStr = String(this.problemId);

      try {
        const statusRes = await api.checkProblemAntiCheatStatus(
          this.contestId,
          problemIdStr
        );

        if (statusRes && statusRes.data && statusRes.data.data) {
          const data = statusRes.data.data;
          this.problemViolationCount = data.problem_violation_count || 0;
          this.violationCount = this.problemViolationCount;

          if (data.problem_solved) {
            console.log("Problem already solved, skipping anti-cheat");
            this.$emit("problem-solved");
            return;
          }

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
        }
      } catch (error) {
        console.error("Anti-cheat status check failed:", error);
        this.problemViolationCount = 0;
        this.violationCount = 0;
      }

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

    // NEW: Method to notify parent about activation
    notifyParentActivation() {
      if (this.shouldActivate && this.rulesAccepted) {
        this.$emit("anti-cheat-activated", true);
      }
    },

    // FIXED: Modified acceptRules
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

    // FIXED: Modified declineRules
    declineRules() {
      this.showRulesModal = false;
      this.shouldActivate = false;
      this.rulesAccepted = false;
      this.$emit("anti-cheat-declined");
    },

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

    startFocusMonitoring() {
      this.focusCheckInterval = setInterval(() => {
        if (!this.isMonitoring || this.problemSolved) return;

        // Check if document has focus
        if (!document.hasFocus() && this.windowHasFocus) {
          this.windowHasFocus = false;
          this.recordViolation("Document lost focus (detected via polling)");
        } else if (document.hasFocus() && !this.windowHasFocus) {
          this.windowHasFocus = true;
        }
      }, 1000);
    },

    stopFocusMonitoring() {
      if (this.focusCheckInterval) {
        clearInterval(this.focusCheckInterval);
        this.focusCheckInterval = null;
      }
    },

    async enterFullscreen() {
      try {
        const elem = document.documentElement;

        if (
          document.fullscreenElement ||
          document.webkitFullscreenElement ||
          document.msFullscreenElement ||
          document.mozFullScreenElement
        ) {
          this.isFullscreen = true;
          return;
        }

        this.isTransitioningToFullscreen = true;

        if (this.fullscreenTransitionTimeout) {
          clearTimeout(this.fullscreenTransitionTimeout);
        }

        console.log("Entering fullscreen - setting transition flag");

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
          console.log(
            "Fullscreen transition period ended - resize monitoring resumed"
          );
        }, 3000);
      } catch (error) {
        console.warn("Fullscreen request failed:", error);
        this.isTransitioningToFullscreen = false;
        if (this.fullscreenTransitionTimeout) {
          clearTimeout(this.fullscreenTransitionTimeout);
          this.fullscreenTransitionTimeout = null;
        }

        if (this.hasEnteredFullscreenBefore) {
          this.recordViolation("Failed to enter fullscreen mode");
        }
      }
    },

    startMonitoring() {
      if (this.isMonitoring || this.problemSolved) return;

      this.isMonitoring = true;
      this.setupEventListeners();

      this.fullscreenCheckInterval = setInterval(() => {
        this.checkFullscreenStatus();
      }, 1000);

      this.devToolsCheckInterval = setInterval(() => {
        this.checkDevTools();
      }, 2000);

      console.log("Anti-cheat monitoring started for problem:", this.problemId);
    },

    stopMonitoring() {
      this.isMonitoring = false;
      this.cleanup();
    },

    setupEventListeners() {
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

      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );
      this.visibilityListenerActive = true;

      document.addEventListener("keydown", this.handleKeyDown);
      this.keyboardListenerActive = true;

      window.addEventListener("blur", this.handleWindowBlur);
      window.addEventListener("focus", this.handleWindowFocus);

      // Mouse leave detection (when cursor leaves window)
      document.addEventListener("mouseleave", this.handleMouseLeave);
      document.addEventListener("mouseenter", this.handleMouseEnter);

      // Page visibility with enhanced detection
      document.addEventListener(
        "visibilitychange",
        this.handleVisibilityChange
      );

      // Additional window state detection
      window.addEventListener("beforeunload", this.handleBeforeUnload);
      window.addEventListener("pagehide", this.handlePageHide);
      window.addEventListener("pageshow", this.handlePageShow);

      document.addEventListener("contextmenu", this.handleContextMenu);
      this.contextMenuListenerActive = true;

      window.addEventListener("resize", this.handleWindowResize);
      window.addEventListener("beforeunload", this.handleBeforeUnload);
    },

    handleFullscreenChange() {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.msFullscreenElement ||
        document.mozFullScreenElement
      );

      console.log("Fullscreen change detected:", {
        wasFullscreen: this.isFullscreen,
        isNowFullscreen: isCurrentlyFullscreen,
        hasEnteredBefore: this.hasEnteredFullscreenBefore,
        isTransitioning: this.isTransitioningToFullscreen,
        isMonitoring: this.isMonitoring,
        problemSolved: this.problemSolved,
      });

      if (
        this.isFullscreen === true &&
        isCurrentlyFullscreen === false &&
        this.hasEnteredFullscreenBefore &&
        this.isMonitoring &&
        !this.problemSolved &&
        !this.isTransitioningToFullscreen
      ) {
        console.log("Recording violation: User exited fullscreen");
        this.recordViolation("Exited fullscreen mode");

        setTimeout(() => {
          if (!this.problemSolved) {
            this.enterFullscreen();
          }
        }, 100);
      }

      this.isFullscreen = isCurrentlyFullscreen;

      if (isCurrentlyFullscreen && !this.hasEnteredFullscreenBefore) {
        this.hasEnteredFullscreenBefore = true;
        console.log(
          "First successful fullscreen entry - flag set, no violation"
        );
      }

      if (isCurrentlyFullscreen && this.isTransitioningToFullscreen) {
        if (this.fullscreenTransitionTimeout) {
          clearTimeout(this.fullscreenTransitionTimeout);
        }

        this.fullscreenTransitionTimeout = setTimeout(() => {
          this.isTransitioningToFullscreen = false;
          console.log(
            "Fullscreen transition period ended after successful entry"
          );
        }, 2000);
      }
    },

    handleVisibilityChange() {
      if (!this.isMonitoring || this.problemSolved) return;

      if (document.hidden) {
        this.pageHiddenTime = Date.now();
        this.recordViolation(
          "Page became hidden (tab switch/minimize detected)"
        );
      } else {
        // Page became visible again
        if (this.pageHiddenTime) {
          const hiddenDuration = Date.now() - this.pageHiddenTime;

          if (hiddenDuration > 100) {
            this.recordViolation(
              `Page visible again after ${hiddenDuration}ms hidden`
            );
          }
        }
      }
    },

    handleKeyDown(event) {
      if (!this.isMonitoring || this.problemSolved) return;

      const forbiddenKeys = [
        { key: "F12" },
        { key: "I", ctrl: true, shift: true },
        { key: "J", ctrl: true, shift: true },
        { key: "C", ctrl: true, shift: true },
        { key: "U", ctrl: true },
        { key: "Tab", alt: true }, // Alt+Tab
        { key: "Tab", alt: true, shift: true }, // Alt+Shift+Tab (reverse tab switching)
        { key: "Escape", alt: true }, // Alt+Escape (another way to switch)
        { key: "Tab", meta: true }, // Cmd+Tab on Mac
        { key: "Meta" },
        { key: "Delete", ctrl: true, alt: true },
        { key: "Tab", ctrl: true }, // Ctrl+Tab (browser tab switching)
        { key: "Tab", ctrl: true, shift: true }, // Ctrl+Shift+Tab
        { key: "t", ctrl: true }, // Ctrl+T (new tab)
        { key: "w", ctrl: true }, // Ctrl+W (close tab)
        { key: "n", ctrl: true }, // Ctrl+N (new window)
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

      this.pressedKeys.add(event.key);
      this.pressedKeys.add(event.code);

      // Check for Alt+Tab combinations with better detection
      if (
        this.pressedKeys.has("Alt") ||
        this.pressedKeys.has("AltLeft") ||
        this.pressedKeys.has("AltRight")
      ) {
        if (this.pressedKeys.has("Tab")) {
          event.preventDefault();
          event.stopPropagation();
          this.recordViolation(
            "Alt+Tab combination detected (global state tracking)"
          );
          return false;
        }
      }

      // Check for Ctrl+Tab (browser tab switching)
      if (
        (this.pressedKeys.has("Control") ||
          this.pressedKeys.has("ControlLeft") ||
          this.pressedKeys.has("ControlRight")) &&
        this.pressedKeys.has("Tab")
      ) {
        event.preventDefault();
        event.stopPropagation();
        this.recordViolation("Ctrl+Tab browser tab switching detected");
        return false;
      }

      // Check for Windows key + Tab (Task view)
      if (
        (this.pressedKeys.has("Meta") ||
          this.pressedKeys.has("MetaLeft") ||
          this.pressedKeys.has("MetaRight")) &&
        this.pressedKeys.has("Tab")
      ) {
        event.preventDefault();
        event.stopPropagation();
        this.recordViolation("Windows+Tab task view detected");
        return false;
      }

      // Additional detection for Alt key sequences
      this.handleAltKeySequence(event);
    },

    handleKeyUp(event) {
      // Remove key from pressed keys set
      this.pressedKeys.delete(event.key);
      this.pressedKeys.delete(event.code);
    },

    // Method 10: Additional page event handlers
    handlePageHide(event) {
      if (this.isMonitoring && !this.problemSolved) {
        this.recordViolation(
          "Page hide event detected (possible task switching)"
        );
      }
    },

    handleAltKeySequence(event) {
      // Track Alt key press sequences
      if (event.key === "Alt") {
        this.altKeyPressed = true;
        this.altKeyStartTime = Date.now();

        // Set timeout to reset Alt key tracking
        setTimeout(() => {
          this.altKeyPressed = false;
        }, 2000);
      }

      // If Alt is held and Tab is pressed
      if (this.altKeyPressed && event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        this.recordViolation("Alt+Tab key sequence detected");
        return false;
      }

      // If Alt is held and other navigation keys are pressed
      if (this.altKeyPressed && ["Escape", "F4"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        this.recordViolation(`Alt+${event.key} navigation detected`);
        return false;
      }
    },

    matchesKeyCombo(event, combo) {
      const keyMatch = event.key === combo.key || event.code === combo.key;
      const ctrlMatch = !!event.ctrlKey === !!combo.ctrl;
      const altMatch = !!event.altKey === !!combo.alt;
      const shiftMatch = !!event.shiftKey === !!combo.shift;
      const metaMatch = !!event.metaKey === !!combo.meta;

      return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch;
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
      if (!this.isMonitoring || this.problemSolved) return;

      this.windowBlurTime = Date.now();
      this.windowHasFocus = false;

      // Short delay to avoid false positives
      setTimeout(() => {
        if (!this.windowHasFocus && this.isMonitoring && !this.problemSolved) {
          this.recordViolation("Window lost focus (possible Alt+Tab)");
        }
      }, 100);
    },

    handlePageShow(event) {
      if (this.isMonitoring && !this.problemSolved) {
        // Ensure fullscreen when page shows again
        setTimeout(() => {
          if (!this.isFullscreen && !this.problemSolved) {
            this.enterFullscreen();
          }
        }, 100);
      }
    },

    handleWindowFocus() {
      if (!this.isMonitoring || this.problemSolved) return;

      this.windowHasFocus = true;

      // Calculate blur duration
      if (this.windowBlurTime) {
        const blurDuration = Date.now() - this.windowBlurTime;

        // If blur was very short, likely Alt+Tab
        if (blurDuration > 100 && blurDuration < 5000) {
          this.recordViolation(
            `Window regained focus after ${blurDuration}ms (Alt+Tab pattern)`
          );
        }
      }

      // Ensure fullscreen when focus returns
      if (!this.isFullscreen && !this.problemSolved) {
        this.enterFullscreen();
      }
    },

    handleMouseLeave() {
      if (!this.isMonitoring || this.problemSolved) return;

      this.mouseLeftWindow = true;
      this.mouseLeaveTime = Date.now();
    },

    handleMouseEnter() {
      if (!this.isMonitoring || this.problemSolved) return;

      if (this.mouseLeftWindow && this.mouseLeaveTime) {
        const awayDuration = Date.now() - this.mouseLeaveTime;

        // If mouse was away for a suspicious amount of time
        if (awayDuration > 500 && awayDuration < 10000) {
          this.recordViolation(
            `Mouse activity pattern suggests window switching (${awayDuration}ms)`
          );
        }
      }

      this.mouseLeftWindow = false;
    },

    handleContextMenu(event) {
      if (this.isMonitoring && !this.problemSolved) {
        event.preventDefault();
        this.recordViolation("Attempted to open context menu");
        return false;
      }
    },

    handleWindowResize() {
      if (this.isTransitioningToFullscreen) {
        console.log("Ignoring window resize during fullscreen transition");
        this.lastWindowHeight = window.innerHeight;
        this.lastWindowWidth = window.innerWidth;
        return;
      }

      const heightDiff = Math.abs(window.innerHeight - this.lastWindowHeight);
      const widthDiff = Math.abs(window.innerWidth - this.lastWindowWidth);

      if (
        (heightDiff > 100 || widthDiff > 100) &&
        this.isMonitoring &&
        !this.problemSolved &&
        this.isFullscreen &&
        this.hasEnteredFullscreenBefore
      ) {
        console.log(
          "Recording violation: Significant resize in fullscreen mode"
        );
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

    // FIXED: Enhanced recordViolation with better logging
    recordViolation(violationType) {
      if (this.problemSolved) {
        console.log(
          "Problem already solved, ignoring violation:",
          violationType
        );
        return;
      }

      console.log(
        `🚨 RECORDING VIOLATION for problem ${this.problemId}: ${violationType}`
      );

      const problemIdStr = String(this.problemId);
      const cooldownKey = `last_violation_${this.contestId}_${problemIdStr}_${violationType}`;
      const lastViolationTime = localStorage.getItem(cooldownKey);
      const now = Date.now();

      if (lastViolationTime && now - parseInt(lastViolationTime) < 15000) {
        console.log(
          `Violation type ${violationType} for problem ${problemIdStr} in cooldown period, ignoring`
        );
        return;
      }

      this.problemViolationCount++;
      this.violationCount = this.problemViolationCount;
      this.lastViolation = violationType;

      console.log(`📊 Updated violation count: ${this.violationCount}`);
      console.log(`⏰ About to show warning modal...`);

      // FIXED: Ensure violation modal shows
      this.sendViolationToBackend(violationType);
      this.showWarningModalWithTimer();

      console.warn(
        `Anti-cheat violation #${this.problemViolationCount} for problem ${problemIdStr}: ${violationType}`
      );
    },

    // FIXED: Enhanced showWarningModalWithTimer with forced modal display
    showWarningModalWithTimer() {
      console.log(
        `🔔 Showing warning modal for violation: ${this.lastViolation}`
      );
      console.log(
        `📋 Modal state before: showWarningModal=${this.showWarningModal}`
      );

      // Force close any existing modal first
      this.showWarningModal = false;

      // Use nextTick to ensure DOM updates, then show modal
      this.$nextTick(() => {
        this.showWarningModal = true;
        this.canCloseModal = false;
        this.modalCountdown = 15;

        console.log(
          `📋 Modal state after nextTick: showWarningModal=${this.showWarningModal}`
        );

        // Force DOM update and check if modal is actually visible
        this.$nextTick(() => {
          const modalElements = document.querySelectorAll(
            ".cheat-warning-modal"
          );
          console.log(`🔍 Found ${modalElements.length} modal elements in DOM`);

          modalElements.forEach((element, index) => {
            console.log(
              `📋 Modal ${index} display style:`,
              window.getComputedStyle(element).display
            );
            console.log(
              `📋 Modal ${index} visibility:`,
              window.getComputedStyle(element).visibility
            );
            console.log(
              `📋 Modal ${index} z-index:`,
              window.getComputedStyle(element).zIndex
            );
          });

          // If modal isn't visible, try to force it
          if (
            modalElements.length === 0 ||
            window.getComputedStyle(modalElements[0]).display === "none"
          ) {
            console.log(`⚠️ Modal not visible, forcing display...`);
            this.forceShowModal();
          }
        });
      });

      if (this.modalCloseTimer) {
        clearInterval(this.modalCloseTimer);
      }

      this.modalCloseTimer = setInterval(() => {
        this.modalCountdown--;
        console.log(`⏳ Modal countdown: ${this.modalCountdown}`);

        if (this.modalCountdown <= 0) {
          this.canCloseModal = true;
          clearInterval(this.modalCloseTimer);
          this.modalCloseTimer = null;
          console.log(`✅ Modal can now be closed`);
        }
      }, 1000);
    },

    // NEW: Force modal to show with direct DOM manipulation if needed
    forceShowModal() {
      console.log(`🔧 Force showing modal with enhanced DOM manipulation`);

      // Remove any existing force modal
      const existingForceModal = document.getElementById(
        "force-violation-modal"
      );
      if (existingForceModal) {
        existingForceModal.remove();
      }

      const modalHTML = `
    <div id="force-violation-modal" style="
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.8) !important;
      z-index: 100001 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      pointer-events: all !important;
    ">
      <div style="
        background: white !important;
        padding: 30px !important;
        border-radius: 8px !important;
        max-width: 500px !important;
        width: 90% !important;
        box-shadow: 0 8px 40px rgba(0,0,0,0.5) !important;
        position: relative !important;
        z-index: 100002 !important;
      ">
        <!-- Your existing modal content with enhanced styles -->
      </div>
    </div>
  `;

      // Append to body instead of current element
      document.body.insertAdjacentHTML("beforeend", modalHTML);

      // Set up countdown for forced modal
      const updateForceModal = () => {
        const countdownElement = document.getElementById("countdown-number");
        const progressBar = document.getElementById("countdown-bar");
        const button = document.getElementById("force-acknowledge-btn");

        if (countdownElement) {
          countdownElement.textContent = this.modalCountdown;
        }

        if (progressBar) {
          progressBar.style.width = `${
            ((15 - this.modalCountdown) / 15) * 100
          }%`;
        }

        if (button) {
          if (this.canCloseModal) {
            button.disabled = false;
            button.style.opacity = "1";
            button.textContent = "I Understand";
            button.onclick = () => {
              const forceModal = document.getElementById(
                "force-violation-modal"
              );
              if (forceModal) {
                forceModal.remove();
              }
              this.acknowledgeWarning();
            };
          } else {
            button.disabled = true;
            button.style.opacity = "0.6";
            button.textContent = `Wait ${this.modalCountdown}s`;
          }
        }
      };

      // Update the forced modal immediately
      updateForceModal();

      // Set up interval to update forced modal
      this.forceModalUpdateInterval = setInterval(updateForceModal, 1000);

      console.log(`✅ Force modal created and displayed`);
    },

    async sendViolationToBackend(violationType) {
      const violationKey = `${violationType}_${Date.now()}`;
      if (this.pendingViolations.has(violationKey)) {
        console.log("Duplicate violation request prevented:", violationType);
        return;
      }

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

        console.log("Sending violation to backend:", violationData);

        const response = await api.reportAntiCheatViolation(violationData);

        if (response && response.data) {
          const responseData = response.data.data || {};

          if (responseData.problem_violation_count !== undefined) {
            this.problemViolationCount = responseData.problem_violation_count;
            this.violationCount = this.problemViolationCount;
          }

          const cooldownKey = `last_violation_${this.contestId}_${problemIdStr}_${violationType}`;
          localStorage.setItem(cooldownKey, Date.now().toString());

          console.log(
            `Violation recorded for problem ${problemIdStr}. Count: ${
              this.problemViolationCount
            }, Penalty: ${this.problemViolationCount * 10} minutes`
          );

          this.$emit("violation-recorded", {
            count: this.problemViolationCount,
            penalty: this.problemViolationCount * 10,
            type: violationType,
            problemId: problemIdStr,
          });
        }
      } catch (error) {
        console.error("Failed to send violation to backend:", error);

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
      return "other";
    },

    // FIXED: Enhanced acknowledgeWarning with force modal cleanup
    acknowledgeWarning() {
      console.log(
        `🔄 User attempting to acknowledge warning. Can close: ${this.canCloseModal}`
      );

      if (!this.canCloseModal) {
        this.$Message.warning({
          content: `Please wait ${this.modalCountdown} seconds before continuing`,
          duration: 2,
        });
        return;
      }

      console.log(`✅ Closing warning modal`);

      // Clean up force modal if it exists
      const forceModal = document.getElementById("force-violation-modal");
      if (forceModal) {
        forceModal.remove();
      }

      if (this.forceModalUpdateInterval) {
        clearInterval(this.forceModalUpdateInterval);
        this.forceModalUpdateInterval = null;
      }

      this.showWarningModal = false;

      if (this.modalCloseTimer) {
        clearInterval(this.modalCloseTimer);
        this.modalCloseTimer = null;
      }

      if (!this.isFullscreen && !this.problemSolved) {
        this.enterFullscreen();
      }
    },

    cleanup() {
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

      // FIXED: Clean up force modal
      if (this.forceModalUpdateInterval) {
        clearInterval(this.forceModalUpdateInterval);
        this.forceModalUpdateInterval = null;
      }

      const forceModal = document.getElementById("force-violation-modal");
      if (forceModal) {
        forceModal.remove();
      }

      if (this.fullscreenTransitionTimeout) {
        clearTimeout(this.fullscreenTransitionTimeout);
        this.fullscreenTransitionTimeout = null;
      }

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
      document.removeEventListener("mouseleave", this.handleMouseLeave);
      document.removeEventListener("mouseenter", this.handleMouseEnter);
      document.removeEventListener("pagehide", this.handlePageHide);
      document.removeEventListener("pageshow", this.handlePageShow);
      document.removeEventListener("keyup", this.handleKeyUp);

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

      // FIXED: Emit deactivation and reset flags
      this.$emit("anti-cheat-activated", false);

      this.pendingViolations.clear();
      this.hasEnteredFullscreenBefore = false;
      this.isTransitioningToFullscreen = false;
      this.rulesAccepted = false;
      this.shouldActivate = false;
      this.altKeyPressed = false;
      this.windowHasFocus = true;
      this.mouseLeftWindow = false;
      this.pressedKeys.clear();

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
  // FIXED: Ensure maximum z-index for violation modal
  &.cheat-warning-modal {
    z-index: 99999 !important;

    /deep/ .ivu-modal {
      z-index: 99999 !important;
    }

    /deep/ .ivu-modal-mask {
      z-index: 99998 !important;
      background: rgba(0, 0, 0, 0.8) !important; // Darker background
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

  :global(.cheat-warning-modal) {
    z-index: 99999 !important;

    .ivu-modal {
      z-index: 99999 !important;
    }

    .ivu-modal-mask {
      z-index: 99998 !important;
      background: rgba(0, 0, 0, 0.8) !important;
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
