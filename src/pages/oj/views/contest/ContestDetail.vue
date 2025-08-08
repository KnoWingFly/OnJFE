<template>
  <div class="flex-container" :class="{ 'anti-cheat-active': antiCheatActive }">
    <div id="contest-main">
      <!--children-->
      <transition name="fadeInUp">
        <router-view></router-view>
      </transition>
      <!--children end-->
      <div class="flex-container" v-if="route_name === 'contest-details'">
        <template>
          <div id="contest-desc">
            <Panel :padding="20" shadow>
              <div slot="title">
                {{ contest.title }}
              </div>
              <div slot="extra" v-show="!antiCheatActive">
                <Tag type="dot" :color="countdownColor">
                  <span id="countdown">{{ countdown }}</span>
                </Tag>
              </div>
              <div v-html="contest.description" class="markdown-body"></div>
              <div v-if="passwordFormVisible" class="contest-password">
                <Input
                  v-model="contestPassword"
                  type="password"
                  placeholder="contest password"
                  class="contest-password-input"
                  @on-enter="checkPassword"
                />
                <Button type="info" @click="checkPassword">Enter</Button>
              </div>
            </Panel>
            <Table
              :columns="columns"
              :data="contest_table"
              disabled-hover
              style="margin-bottom: 40px"
              v-show="!antiCheatActive"
            ></Table>
          </div>
        </template>
      </div>
    </div>

    <!-- Hide contest menu when anti-cheat is active -->
    <div v-show="showMenu && !antiCheatActive" id="contest-menu">
      <VerticalMenu @on-click="handleRoute">
        <VerticalMenu-item
          :route="{ name: 'contest-details', params: { contestID: contestID } }"
        >
          <Icon type="home"></Icon>
          {{ $t("m.Overview") }}
        </VerticalMenu-item>

        <VerticalMenu-item
          :disabled="contestMenuDisabled"
          :route="{
            name: 'contest-announcement-list',
            params: { contestID: contestID },
          }"
        >
          <Icon type="chatbubble-working"></Icon>
          {{ $t("m.Announcements") }}
        </VerticalMenu-item>

        <VerticalMenu-item
          :disabled="contestMenuDisabled"
          :route="{
            name: 'contest-problem-list',
            params: { contestID: contestID },
          }"
        >
          <Icon type="ios-photos"></Icon>
          {{ $t("m.Problems") }}
        </VerticalMenu-item>

        <VerticalMenu-item
          v-if="OIContestRealTimePermission"
          :disabled="contestMenuDisabled"
          :route="{ name: 'contest-submission-list' }"
        >
          <Icon type="navicon-round"></Icon>
          {{ $t("m.Submissions") }}
        </VerticalMenu-item>

        <VerticalMenu-item
          v-if="OIContestRealTimePermission"
          :disabled="contestMenuDisabled"
          :route="{ name: 'contest-rank', params: { contestID: contestID } }"
        >
          <Icon type="stats-bars"></Icon>
          {{ $t("m.Rankings") }}
        </VerticalMenu-item>

        <VerticalMenu-item
          :disabled="contestMenuDisabled"
          :route="{
            name: isContestAdmin ? 'contest-review-admin' : 'contest-review',
            params: { contestID: contestID },
          }"
        >
          <Icon type="ios-star"></Icon>
          {{
            isContestAdmin
              ? "Review Management"
              : $t("m.Website_Review") || "Website Review"
          }}
          <Badge
            v-if="!isContestAdmin && reviewRequired && !reviewSubmitted"
            status="warning"
          />
          <Badge
            v-if="isContestAdmin && pendingReviewsCount > 0"
            :count="pendingReviewsCount"
          />
        </VerticalMenu-item>

        <VerticalMenu-item
          v-if="showAdminHelper"
          :route="{ name: 'acm-helper', params: { contestID: contestID } }"
        >
          <Icon type="ios-paw"></Icon>
          {{ $t("m.Admin_Helper") }}
        </VerticalMenu-item>
      </VerticalMenu>
    </div>
  </div>
</template>

<script>
import moment from "moment";
import api from "@oj/api";
import { mapState, mapGetters, mapActions } from "vuex";
import { types } from "@/store";
import { CONTEST_STATUS_REVERSE, CONTEST_STATUS } from "@/utils/constants";
import time from "@/utils/time";

export default {
  name: "ContestDetail",
  components: {},
  data() {
    return {
      CONTEST_STATUS: CONTEST_STATUS,
      route_name: "",
      btnLoading: false,
      contestID: "",
      contestPassword: "",
      reviewRequired: true, // NEW: Track if review is required
      reviewSubmitted: false, // NEW: Track if user has submitted review
      pendingReviewsCount: 0,
      columns: [
        {
          title: this.$i18n.t("m.StartAt"),
          render: (h, params) => {
            return h("span", time.utcToLocal(params.row.start_time));
          },
        },
        {
          title: this.$i18n.t("m.EndAt"),
          render: (h, params) => {
            return h("span", time.utcToLocal(params.row.end_time));
          },
        },
        {
          title: this.$i18n.t("m.ContestType"),
          render: (h, params) => {
            return h(
              "span",
              this.$i18n.t(
                "m." + params.row.contest_type
                  ? params.row.contest_type.replace(" ", "_")
                  : ""
              )
            );
          },
        },
        {
          title: this.$i18n.t("m.Rule"),
          render: (h, params) => {
            return h("span", this.$i18n.t("m." + params.row.rule_type));
          },
        },
        {
          title: this.$i18n.t("m.Creator"),
          render: (h, data) => {
            return h("span", data.row.created_by.username);
          },
        },
      ],
    };
  },
  mounted() {
    this.contestID = this.$route.params.contestID;
    this.route_name = this.$route.name;
    this.loadPendingReviewsCount();
    this.$store.dispatch("getContest").then((res) => {
      this.changeDomTitle({ title: res.data.data.title });
      let data = res.data.data;
      let endTime = moment(data.end_time);
      if (endTime.isAfter(moment(data.now))) {
        this.timer = setInterval(() => {
          this.$store.commit(types.NOW_ADD_1S);
        }, 1000);
      }
    });

    // NEW: Check review status
    this.checkReviewStatus();
  },
  methods: {
    ...mapActions(["changeDomTitle"]),
    handleRoute(route) {
      this.$router.push(route);
    },
    checkPassword() {
      if (this.contestPassword === "") {
        this.$error("Password can't be empty");
        return;
      }
      this.btnLoading = true;
      api.checkContestPassword(this.contestID, this.contestPassword).then(
        (res) => {
          this.$success("Succeeded");
          this.$store.commit(types.CONTEST_ACCESS, { access: true });
          this.btnLoading = false;
        },
        (res) => {
          this.btnLoading = false;
        }
      );
    },
    async loadPendingReviewsCount() {
      if (this.isContestAdmin) {
        try {
          const res = await api.getContestReviewStatsAdmin(this.contestID);
          this.pendingReviewsCount = res.data.data.total_reviews || 0;
        } catch (error) {
          console.log("Error loading review count:", error);
        }
      }
    },

    async loadReviews() {
      this.loading = true;
      try {
        const offset = (this.page - 1) * this.limit;
        const filters = {};

        if (this.ratingFilter) {
          filters.rating_filter = this.ratingFilter;
        }
        if (this.technicalIssuesFilter) {
          filters.technical_issues = this.technicalIssuesFilter;
        }

        console.log(
          "Loading reviews for contest:",
          this.$route.params.contestID
        );
        console.log("Filters:", filters);

        const res = await api.getContestReviewList(
          this.$route.params.contestID,
          offset,
          this.limit,
          true, // isAdmin flag
          filters
        );

        console.log("API Response:", res.data);

        // Check the response structure
        if (res.data && res.data.data) {
          if (res.data.data.results) {
            // Paginated response
            this.reviews = res.data.data.results;
            this.total = res.data.data.total;
          } else if (Array.isArray(res.data.data)) {
            // Direct array response
            this.reviews = res.data.data;
            this.total = res.data.data.length;
          }
        }

        console.log("Loaded reviews:", this.reviews);
      } catch (err) {
        this.$error("Failed to load reviews");
        console.error("Failed to load reviews:", err);
      } finally {
        this.loading = false;
      }
    },

    // NEW: Check if user has submitted review
    async checkReviewStatus() {
      try {
        // This would be an API call to check review status
        // const response = await api.getContestReviewStatus(this.contestID)
        // For now, we'll simulate this

        // You'll need to implement this API call
        // this.reviewSubmitted = response.data.data.hasReview || false

        // Temporary simulation - remove this when API is implemented
        this.reviewSubmitted = false;

        // Check if contest is active to determine if review is required
        if (
          this.contestStatus === CONTEST_STATUS.CONTEST_UNDERWAY ||
          this.contestStatus === CONTEST_STATUS.CONTEST_ENDED
        ) {
          this.reviewRequired = true;
        }
      } catch (error) {
        console.log("Error checking review status:", error);
        this.reviewRequired = true;
        this.reviewSubmitted = false;
      }
    },
  },
  computed: {
    ...mapState({
      showMenu: (state) => state.contest.itemVisible.menu,
      contest: (state) => state.contest.contest,
      contest_table: (state) => [state.contest.contest],
      now: (state) => state.contest.now,
    }),
    ...mapGetters([
      "contestMenuDisabled",
      "contestRuleType",
      "contestStatus",
      "countdown",
      "isContestAdmin",
      "OIContestRealTimePermission",
      "passwordFormVisible",
      "antiCheatActive",
    ]),
    countdownColor() {
      if (this.contestStatus) {
        return CONTEST_STATUS_REVERSE[this.contestStatus].color;
      }
    },
    showAdminHelper() {
      return this.isContestAdmin && this.contestRuleType === "ACM";
    },
  },
  watch: {
    $route(newVal) {
      this.route_name = newVal.name;
      this.contestID = newVal.params.contestID;
      this.changeDomTitle({ title: this.contest.title });

      // NEW: Recheck review status when route changes
      this.checkReviewStatus();
    },
  },
  beforeDestroy() {
    clearInterval(this.timer);
    this.$store.commit(types.CLEAR_CONTEST);
  },
};
</script>

<style scoped lang="less">
pre {
  display: inline-block;
}

#countdown {
  font-size: 16px;
}

.flex-container {
  #contest-main {
    flex: 1 1;
    width: 0;
    #contest-desc {
      flex: auto;
    }
  }
  #contest-menu {
    flex: none;
    width: 210px;
    margin-left: 20px;
  }
  .contest-password {
    margin-top: 20px;
    margin-bottom: -10px;
    &-input {
      width: 200px;
      margin-right: 10px;
    }
  }

  // Anti-cheat mode styles
  &.anti-cheat-active {
    #contest-main {
      width: 100% !important;
      max-width: none !important;
    }
    #contest-menu {
      display: none !important;
    }
  }
}
</style>
