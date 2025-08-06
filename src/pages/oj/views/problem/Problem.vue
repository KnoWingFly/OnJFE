<template>
  <div class="flex-container">
    <!-- Anti-Cheat Component -->
    <AntiCheat
      v-if="antiCheatActive"
      ref="antiCheat"
      :contest-id="contestID"
      :problem-id="problem._id"
      :is-active="antiCheatActive"
      :problem-status="problem.my_status"
      @anti-cheat-declined="handleAntiCheatDeclined"
      @violation-recorded="handleViolationRecorded"
      @problem-solved="
        () => {
          this.antiCheatActive = false;
        }
      "
    />
    <div id="problem-main">
      <!--problem main-->
      <Panel :padding="40" shadow>
        <div slot="title">{{ problem.title }}</div>
        <div id="problem-content" class="markdown-body" v-katex>
          <p class="title">{{ $t("m.Description") }}</p>
          <p class="content" v-html="problem.description"></p>
          <!-- {{$t('m.music')}} -->
          <p class="title">
            {{ $t("m.Input") }}
            <span v-if="problem.io_mode.io_mode == 'File IO'"
              >({{ $t("m.FromFile") }}: {{ problem.io_mode.input }})</span
            >
          </p>
          <p class="content" v-html="problem.input_description"></p>

          <p class="title">
            {{ $t("m.Output") }}
            <span v-if="problem.io_mode.io_mode == 'File IO'"
              >({{ $t("m.ToFile") }}: {{ problem.io_mode.output }})</span
            >
          </p>
          <p class="content" v-html="problem.output_description"></p>

          <div v-for="(sample, index) of problem.samples" :key="index">
            <div class="flex-container sample">
              <div class="sample-input">
                <p class="title">
                  {{ $t("m.Sample_Input") }} {{ index + 1 }}
                  <a
                    class="copy"
                    v-clipboard:copy="sample.input"
                    v-clipboard:success="onCopy"
                    v-clipboard:error="onCopyError"
                  >
                    <Icon type="clipboard"></Icon>
                  </a>
                </p>
                <pre>{{ sample.input }}</pre>
              </div>
              <div class="sample-output">
                <p class="title">{{ $t("m.Sample_Output") }} {{ index + 1 }}</p>
                <pre>{{ sample.output }}</pre>
              </div>
            </div>
          </div>

          <div v-if="problem.hint">
            <p class="title">{{ $t("m.Hint") }}</p>
            <Card dis-hover>
              <div class="content" v-html="problem.hint"></div>
            </Card>
          </div>

          <div v-if="problem.source">
            <p class="title">{{ $t("m.Source") }}</p>
            <p class="content">{{ problem.source }}</p>
          </div>
        </div>
      </Panel>
      <!--problem main end-->
      <Card :padding="20" id="submit-code" dis-hover>
        <CodeMirror
          :value.sync="code"
          :languages="problem.languages"
          :language="language"
          :theme="theme"
          @resetCode="onResetToTemplate"
          @changeTheme="onChangeTheme"
          @changeLang="onChangeLang"
        ></CodeMirror>
        <Row type="flex" justify="space-between">
          <Col :span="10">
            <div class="status" v-if="statusVisible">
              <template
                v-if="
                  !this.contestID ||
                  (this.contestID && OIContestRealTimePermission)
                "
              >
                <span>{{ $t("m.Status") }}</span>
                <Tag
                  type="dot"
                  :color="submissionStatus.color"
                  @click.native="handleRoute('/status/' + submissionId)"
                >
                  {{ $t("m." + submissionStatus.text.replace(/ /g, "_")) }}
                </Tag>
              </template>
              <template
                v-else-if="this.contestID && !OIContestRealTimePermission"
              >
                <Alert type="success" show-icon>{{
                  $t("m.Submitted_successfully")
                }}</Alert>
              </template>
            </div>
            <div v-else-if="problem.my_status === 0">
              <Alert type="success" show-icon>{{
                $t("m.You_have_solved_the_problem")
              }}</Alert>
            </div>
            <div
              v-else-if="
                this.contestID &&
                !OIContestRealTimePermission &&
                submissionExists
              "
            >
              <Alert type="success" show-icon>{{
                $t("m.You_have_submitted_a_solution")
              }}</Alert>
            </div>
            <div v-if="contestEnded">
              <Alert type="warning" show-icon>{{
                $t("m.Contest_has_ended")
              }}</Alert>
            </div>
          </Col>

          <Col :span="12">
            <template v-if="captchaRequired">
              <div class="captcha-container">
                <Tooltip
                  v-if="captchaRequired"
                  content="Click to refresh"
                  placement="top"
                >
                  <img :src="captchaSrc" @click="getCaptchaSrc" />
                </Tooltip>
                <Input v-model="captchaCode" class="captcha-code" />
              </div>
            </template>
            <Button
              type="warning"
              icon="edit"
              :loading="submitting"
              @click="submitCode"
              :disabled="problemSubmitDisabled || submitted"
              class="fl-right"
            >
              <span v-if="submitting">{{ $t("m.Submitting") }}</span>
              <span v-else>{{ $t("m.Submit") }}</span>
            </Button>
          </Col>
        </Row>
      </Card>
    </div>

    <div id="right-column">
      <VerticalMenu @on-click="handleRoute">
        <template v-if="this.contestID">
          <VerticalMenu-item
            :route="{
              name: 'contest-problem-list',
              params: { contestID: contestID },
            }"
          >
            <Icon type="ios-photos"></Icon>
            {{ $t("m.Problems") }}
          </VerticalMenu-item>

          <VerticalMenu-item
            :route="{
              name: 'contest-announcement-list',
              params: { contestID: contestID },
            }"
          >
            <Icon type="chatbubble-working"></Icon>
            {{ $t("m.Announcements") }}
          </VerticalMenu-item>
        </template>

        <VerticalMenu-item
          v-if="!this.contestID || OIContestRealTimePermission"
          :route="submissionRoute"
        >
          <Icon type="navicon-round"></Icon>
          {{ $t("m.Submissions") }}
        </VerticalMenu-item>

        <template v-if="this.contestID">
          <VerticalMenu-item
            v-if="!this.contestID || OIContestRealTimePermission"
            :route="{ name: 'contest-rank', params: { contestID: contestID } }"
          >
            <Icon type="stats-bars"></Icon>
            {{ $t("m.Rankings") }}
          </VerticalMenu-item>
          <VerticalMenu-item
            :route="{
              name: 'contest-details',
              params: { contestID: contestID },
            }"
          >
            <Icon type="home"></Icon>
            {{ $t("m.View_Contest") }}
          </VerticalMenu-item>
        </template>
      </VerticalMenu>

      <Card id="info">
        <div slot="title" class="header">
          <Icon type="information-circled"></Icon>
          <span class="card-title">{{ $t("m.Information") }}</span>
        </div>
        <ul>
          <li>
            <p>ID</p>
            <p>{{ problem._id }}</p>
          </li>
          <li>
            <p>{{ $t("m.Time_Limit") }}</p>
            <p>{{ problem.time_limit }}MS</p>
          </li>
          <li>
            <p>{{ $t("m.Memory_Limit") }}</p>
            <p>{{ problem.memory_limit }}MB</p>
          </li>
          <li>
            <p>{{ $t("m.IOMode") }}</p>
            <p>{{ problem.io_mode.io_mode }}</p>
          </li>
          <li>
            <p>{{ $t("m.Created") }}</p>
            <p>{{ problem.created_by.username }}</p>
          </li>
          <li v-if="problem.difficulty">
            <p>{{ $t("m.Level") }}</p>
            <p>{{ $t("m." + problem.difficulty) }}</p>
          </li>
          <li v-if="problem.total_score">
            <p>{{ $t("m.Score") }}</p>
            <p>{{ problem.total_score }}</p>
          </li>
          <li>
            <p>{{ $t("m.Tags") }}</p>
            <p>
              <Poptip trigger="hover" placement="left-end">
                <a>{{ $t("m.Show") }}</a>
                <div slot="content">
                  <Tag v-for="tag in problem.tags" :key="tag">{{ tag }}</Tag>
                </div>
              </Poptip>
            </p>
          </li>
        </ul>
      </Card>

      <Card
        id="pieChart"
        :padding="0"
        v-if="!this.contestID || OIContestRealTimePermission"
      >
        <div slot="title">
          <Icon type="ios-analytics"></Icon>
          <span class="card-title">{{ $t("m.Statistic") }}</span>
          <Button
            type="ghost"
            size="small"
            id="detail"
            @click="graphVisible = !graphVisible"
            >Details</Button
          >
        </div>
        <div class="echarts">
          <ECharts :options="pie"></ECharts>
        </div>
      </Card>
    </div>

    <Modal v-model="graphVisible">
      <div id="pieChart-detail">
        <ECharts :options="largePie" :initOptions="largePieInitOpts"></ECharts>
      </div>
      <div slot="footer">
        <Button type="ghost" @click="graphVisible = false">{{
          $t("m.Close")
        }}</Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import { mapGetters, mapActions } from "vuex";
import { types } from "../../../../store";
import CodeMirror from "@oj/components/CodeMirror.vue";
import storage from "@/utils/storage";
import { FormMixin } from "@oj/components/mixins";
import {
  JUDGE_STATUS,
  CONTEST_STATUS,
  buildProblemCodeKey,
} from "@/utils/constants";
import api from "@oj/api";
import { pie, largePie } from "./chartData";
import AntiCheat from "@oj/components/AntiCheat.vue";

// 只显示这些状态的图形占用
const filtedStatus = ["-1", "-2", "0", "1", "2", "3", "4", "8"];

export default {
  name: "Problem",
  components: {
    CodeMirror,
    AntiCheat,
  },
  mixins: [FormMixin],
  data() {
    return {
      statusVisible: false,
      captchaRequired: false,
      graphVisible: false,
      submissionExists: false,
      captchaCode: "",
      captchaSrc: "",
      contestID: "",
      problemID: "",
      submitting: false,
      code: "",
      language: "C++",
      theme: "solarized",
      submissionId: "",
      submitted: false,

      // Anti-cheat related data
      antiCheatActive: false,
      antiCheatViolations: 0,
      problemSolved: false,

      result: {
        result: 9,
      },
      problem: {
        title: "",
        description: "",
        hint: "",
        my_status: "",
        template: {},
        languages: [],
        created_by: {
          username: "",
        },
        tags: [],
        io_mode: { io_mode: "Standard IO" },
      },
      pie: pie,
      largePie: largePie,
      // echarts 无法获取隐藏dom的大小，需手动指定
      largePieInitOpts: {
        width: "500",
        height: "480",
      },
    };
  },
  beforeRouteEnter(to, from, next) {
    let problemCode = storage.get(
      buildProblemCodeKey(to.params.problemID, to.params.contestID)
    );
    if (problemCode) {
      next((vm) => {
        vm.language = problemCode.language;
        vm.code = problemCode.code;
        vm.theme = problemCode.theme;
      });
    } else {
      next();
    }
  },
  async mounted() {
    this.$store.commit(types.CHANGE_CONTEST_ITEM_VISIBLE, { menu: false });
    await this.init();
    this.displayAntiCheatStatus();
  },
  methods: {
    ...mapActions(["changeDomTitle"]),
    async init() {
      this.$Loading.start();
      this.contestID = this.$route.params.contestID;
      this.problemID = this.$route.params.problemID;

      let func =
        this.$route.name === "problem-details"
          ? "getProblem"
          : "getContestProblem";

      try {
        const res = await api[func](this.problemID, this.contestID);
        this.$Loading.finish();

        let problem = res.data.data;
        this.changeDomTitle({ title: problem.title });

        // Check submission exists
        try {
          const submissionRes = await api.submissionExists(problem.id);
          this.submissionExists = submissionRes.data.data;
        } catch (error) {
          console.warn("Could not check submission exists:", error);
        }

        problem.languages = problem.languages.sort();
        this.problem = problem;

        // ONLY call anti-cheat check after problem data is fully loaded
        // and only if we haven't already set it up
        if (this.contestID && !this.antiCheatActive) {
          this.checkAntiCheatRequirement();
        }

        if (problem.statistic_info) {
          this.changePie(problem);
        }

        // Handle code template loading
        if (this.code !== "") {
          return;
        }

        this.language = this.problem.languages[0];
        let template = this.problem.template;
        if (template && template[this.language]) {
          this.code = template[this.language];
        }
      } catch (error) {
        this.$Loading.error();
        console.error("Failed to load problem:", error);
      }
    },

    handleViolationRecorded(violationData) {
      this.$Message.warning({
        content: `Problem violation detected! This problem: ${violationData.count} violations (${violationData.penalty} minutes penalty)`,
        duration: 6,
      });
    },

    handleAntiCheatDeclined() {
      // User declined anti-cheat rules, redirect them back
      this.$Message.warning(
        "You must accept the anti-cheat rules to participate in the contest"
      );
      this.$router.push({
        name: "contest-problem-list",
        params: { contestID: this.contestID },
      });
    },

    changePie(problemData) {
      // 只显示特定的一些状态
      for (let k in problemData.statistic_info) {
        if (filtedStatus.indexOf(k) === -1) {
          delete problemData.statistic_info[k];
        }
      }
      let acNum = problemData.accepted_number;
      let data = [
        { name: "WA", value: problemData.submission_number - acNum },
        { name: "AC", value: acNum },
      ];
      this.pie.series[0].data = data;
      // 只把大图的AC selected下，这里需要做一下deepcopy
      let data2 = JSON.parse(JSON.stringify(data));
      data2[1].selected = true;
      this.largePie.series[1].data = data2;

      // 根据结果设置legend,没有提交过的legend不显示
      let legend = Object.keys(problemData.statistic_info).map(
        (ele) => JUDGE_STATUS[ele].short
      );
      if (legend.length === 0) {
        legend.push("AC", "WA");
      }
      this.largePie.legend.data = legend;

      // 把ac的数据提取出来放在最后
      let acCount = problemData.statistic_info["0"];
      delete problemData.statistic_info["0"];

      let largePieData = [];
      Object.keys(problemData.statistic_info).forEach((ele) => {
        largePieData.push({
          name: JUDGE_STATUS[ele].short,
          value: problemData.statistic_info[ele],
        });
      });
      largePieData.push({ name: "AC", value: acCount });
      this.largePie.series[0].data = largePieData;
    },
    handleRoute(route) {
      this.$router.push(route);
    },
    onChangeLang(newLang) {
      if (this.problem.template[newLang]) {
        if (this.code.trim() === "") {
          this.code = this.problem.template[newLang];
        }
      }
      this.language = newLang;
    },
    onChangeTheme(newTheme) {
      this.theme = newTheme;
    },
    onResetToTemplate() {
      this.$Modal.confirm({
        content: this.$i18n.t("m.Are_you_sure_you_want_to_reset_your_code"),
        onOk: () => {
          let template = this.problem.template;
          if (template && template[this.language]) {
            this.code = template[this.language];
          } else {
            this.code = "";
          }
        },
      });
    },
    shouldActivateAntiCheat() {
      return (
        this.contestID &&
        this.problem &&
        this.problem._id &&
        this.problem.my_status !== 0 &&
        !this.isProblemSolved()
      );
    },
    checkSubmissionStatus() {
      if (this.refreshStatus) {
        clearTimeout(this.refreshStatus);
      }

      const checkStatus = () => {
        let id = this.submissionId;
        api.getSubmission(id).then(
          (res) => {
            this.result = res.data.data;

            if (Object.keys(res.data.data.statistic_info).length !== 0) {
              this.submitting = false;
              this.submitted = false;
              clearTimeout(this.refreshStatus);

              // Check if submission was accepted
              if (res.data.data.result === 0 && this.contestID) {
                // Problem solved - disable anti-cheat
                this.problem.my_status = 0;
                this.problemSolved = true;
                this.antiCheatActive = false;

                // Notify AntiCheat component safely
                if (
                  this.$refs.antiCheat &&
                  typeof this.$refs.antiCheat.onProblemSolved === "function"
                ) {
                  this.$refs.antiCheat.onProblemSolved();
                }

                // Show success message with penalty info
                this.showSuccessMessageWithPenalty();
                this.storeProblemSolvedStatus();
              }

              this.init();
            } else {
              this.refreshStatus = setTimeout(checkStatus, 2000);
            }
          },
          (res) => {
            this.submitting = false;
            clearTimeout(this.refreshStatus);
          }
        );
      };

      this.refreshStatus = setTimeout(checkStatus, 2000);
    },

    async showSuccessMessageWithPenalty() {
      try {
        const penaltyRes = await api.checkProblemAntiCheatStatus(
          this.contestID,
          this.problemID
        );
        const data = penaltyRes.data.data;
        if (data.problem_violation_count > 0) {
          this.$Message.success({
            content: `Problem solved! ${data.problem_penalty_minutes} minutes penalty was applied to this problem for ${data.problem_violation_count} violations.`,
            duration: 8,
          });
        } else {
          this.$Message.success(
            "Problem solved! No penalties applied for this problem."
          );
        }
      } catch (error) {
        this.$Message.success("Problem solved!");
      }
    },

    displayAntiCheatStatus() {
      if (!this.contestID || !this.problemID) return;

      // Use problem-specific API
      api
        .checkProblemAntiCheatStatus(this.contestID, this.problemID)
        .then((res) => {
          const data = res.data.data;
          if (data.problem_violation_count > 0) {
            this.$Message.info({
              content: `This problem: ${data.problem_violation_count} violations (${data.problem_penalty_minutes} min penalty)`,
              duration: 6,
            });
          }
        })
        .catch(() => {
          // Ignore errors for display
        });
    },

    storeProblemSolvedStatus() {
      if (this.contestID && this.problemID) {
        let solvedProblems = JSON.parse(
          localStorage.getItem(`solved_problems_${this.contestID}`) || "[]"
        );
        if (!solvedProblems.includes(this.problemID)) {
          solvedProblems.push(this.problemID);
          localStorage.setItem(
            `solved_problems_${this.contestID}`,
            JSON.stringify(solvedProblems)
          );
        }
      }
    },

    isProblemSolved() {
      if (!this.contestID || !this.problemID) return false;

      // Check from problem data first (most reliable)
      if (this.problem.my_status === 0) {
        return true;
      }

      // Fallback: check local storage
      let solvedProblems = JSON.parse(
        localStorage.getItem(`solved_problems_${this.contestID}`) || "[]"
      );
      return solvedProblems.includes(this.problemID);
    },

    async submitCode() {
      if (this.code.trim() === "") {
        this.$error(this.$i18n.t("m.Code_can_not_be_empty"));
        return;
      }

      this.submissionId = "";
      this.result = { result: 9 };
      this.submitting = true;

      let data = {
        problem_id: this.problem.id,
        language: this.language,
        code: this.code,
        contest_id: this.contestID,
      };

      if (this.captchaRequired) {
        data.captcha = this.captchaCode;
      }

      const submitFunc = (data, detailsVisible) => {
        this.statusVisible = true;
        api.submitCode(data).then(
          (res) => {
            this.submissionId = res.data.data && res.data.data.submission_id;
            this.submitting = false;
            this.submissionExists = true;

            if (!detailsVisible) {
              this.$Modal.success({
                title: this.$i18n.t("m.Success"),
                content: this.$i18n.t("m.Submit_code_successfully"),
              });
              return;
            }

            this.submitted = true;
            this.checkSubmissionStatus();
          },
          (res) => {
            this.getCaptchaSrc();
            if (res.data.data.startsWith("Captcha is required")) {
              this.captchaRequired = true;
            }
            this.submitting = false;
            this.statusVisible = false;
          }
        );
      };

      if (this.contestRuleType === "OI" && !this.OIContestRealTimePermission) {
        if (this.submissionExists) {
          this.$Modal.confirm({
            title: "",
            content:
              "<h3>" +
              this.$i18n.t(
                "m.You_have_submission_in_this_problem_sure_to_cover_it"
              ) +
              "<h3>",
            onOk: () => {
              setTimeout(() => {
                submitFunc(data, false);
              }, 1000);
            },
            onCancel: () => {
              this.submitting = false;
            },
          });
        } else {
          submitFunc(data, false);
        }
      } else {
        submitFunc(data, true);
      }
    },
    onCopy(event) {
      this.$success("Code copied");
    },
    onCopyError(e) {
      this.$error("Failed to copy code");
    },

    checkAntiCheatRequirement() {
      // Add guard clause to prevent unnecessary calls
      if (!this.contestID) {
        console.log("No contest ID - anti-cheat disabled");
        this.antiCheatActive = false;
        return;
      }

      // Check if problem data is loaded
      if (!this.problem || !this.problem._id) {
        console.log("Problem data not loaded yet - skipping anti-cheat check");
        return;
      }

      // Check if problem is already solved (my_status === 0 means solved)
      if (this.problem.my_status === 0) {
        console.log(
          `Problem ${this.problemID} already solved - anti-cheat disabled`
        );
        this.antiCheatActive = false;
        return;
      }

      // Check localStorage for solved status as backup
      if (this.isProblemSolved()) {
        console.log(
          `Problem ${this.problemID} marked as solved in localStorage - anti-cheat disabled`
        );
        this.antiCheatActive = false;
        return;
      }

      // Only activate if all conditions are met
      console.log(`Anti-cheat activated for problem ${this.problemID}`);
      this.antiCheatActive = true;
    },

    handleAntiCheatDeclined() {
      // User declined anti-cheat rules, redirect them back
      this.$Message.warning(
        "You must accept the anti-cheat rules to participate in the contest"
      );
      this.$router.push({
        name: "contest-problem-list",
        params: { contestID: this.contestID },
      });
    },
  },
  computed: {
    ...mapGetters([
      "problemSubmitDisabled",
      "contestRuleType",
      "OIContestRealTimePermission",
      "contestStatus",
    ]),
    contest() {
      return this.$store.state.contest.contest;
    },
    contestEnded() {
      return this.contestStatus === CONTEST_STATUS.ENDED;
    },
    submissionStatus() {
      return {
        text: JUDGE_STATUS[this.result.result]["name"],
        color: JUDGE_STATUS[this.result.result]["color"],
      };
    },
    submissionRoute() {
      if (this.contestID) {
        return {
          name: "contest-submission-list",
          query: { problemID: this.problemID },
        };
      } else {
        return {
          name: "submission-list",
          query: { problemID: this.problemID },
        };
      }
    },
  },
  beforeRouteLeave(to, from, next) {
    // Existing code...
    clearInterval(this.refreshStatus);
    this.$store.commit(types.CHANGE_CONTEST_ITEM_VISIBLE, { menu: true });
    storage.set(buildProblemCodeKey(this.problem._id, from.params.contestID), {
      code: this.code,
      language: this.language,
      theme: this.theme,
    });

    // Clean up anti-cheat
    if (this.antiCheatActive) {
      this.antiCheatActive = false;
    }

    next();
  },
  watch: {
    $route() {
      // Reset anti-cheat state when route changes
      this.antiCheatActive = false;
      this.problemSolved = false;
      this.violationCount = 0;
      this.init();
    },

    "problem.my_status"(newStatus, oldStatus) {
      console.log(`Problem status changed from ${oldStatus} to ${newStatus}`);

      // Only react to meaningful status changes
      if (newStatus === oldStatus) return;

      if (newStatus === 0) {
        // Problem is now solved
        this.problemSolved = true;
        this.antiCheatActive = false;
        this.storeProblemSolvedStatus();
        console.log("Problem solved - anti-cheat disabled");
      } else if (
        this.contestID &&
        newStatus !== null &&
        newStatus !== undefined
      ) {
        // Problem is not solved, recheck anti-cheat requirement
        this.checkAntiCheatRequirement();
      }
    },

    // Remove the problematic problem watcher or fix it
    problem: {
      handler(newProblem, oldProblem) {
        // Only trigger if we actually switched problems
        if (newProblem && oldProblem && newProblem._id !== oldProblem._id) {
          console.log(
            `Switched from problem ${oldProblem._id} to ${newProblem._id}`
          );
          this.checkAntiCheatRequirement();
        }
      },
      deep: false, // Don't watch deeply to avoid unnecessary triggers
    },
  },
};
</script>

<style lang="less" scoped>
.anti-cheat-penalty-info {
  background: #fff2e8;
  border: 1px solid #ff9900;
  border-radius: 4px;
  padding: 10px;
  margin: 10px 0;

  .penalty-text {
    color: #ff9900;
    font-weight: 600;
  }
}
.problem-solved-notice {
  background: #f6ffed;
  border: 1px solid #52c41a;
  border-radius: 4px;
  padding: 10px;
  margin: 10px 0;

  .success-text {
    color: #52c41a;
    font-weight: 600;
  }
}
.card-title {
  margin-left: 8px;
}

.flex-container {
  #problem-main {
    flex: auto;
    margin-right: 18px;
  }
  #right-column {
    flex: none;
    width: 220px;
  }
}

#problem-content {
  margin-top: -50px;
  .title {
    font-size: 20px;
    font-weight: 400;
    margin: 25px 0 8px 0;
    color: #3091f2;
    .copy {
      padding-left: 8px;
    }
  }
  p.content {
    margin-left: 25px;
    margin-right: 20px;
    font-size: 15px;
  }
  .sample {
    align-items: stretch;
    &-input,
    &-output {
      width: 50%;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      margin-right: 5%;
    }
    pre {
      flex: 1 1 auto;
      align-self: stretch;
      border-style: solid;
      background: transparent;
    }
  }
}

#submit-code {
  margin-top: 20px;
  margin-bottom: 20px;
  .status {
    float: left;
    span {
      margin-right: 10px;
      margin-left: 10px;
    }
  }
  .captcha-container {
    display: inline-block;
    .captcha-code {
      width: auto;
      margin-top: -20px;
      margin-left: 20px;
    }
  }
}

#info {
  margin-bottom: 20px;
  margin-top: 20px;
  ul {
    list-style-type: none;
    li {
      border-bottom: 1px dotted #e9eaec;
      margin-bottom: 10px;
      p {
        display: inline-block;
      }
      p:first-child {
        width: 90px;
      }
      p:last-child {
        float: right;
      }
    }
  }
}

.fl-right {
  float: right;
}

#pieChart {
  .echarts {
    height: 250px;
    width: 210px;
  }
  #detail {
    position: absolute;
    right: 10px;
    top: 10px;
  }
}

#pieChart-detail {
  margin-top: 20px;
  width: 500px;
  height: 480px;
}
</style>
