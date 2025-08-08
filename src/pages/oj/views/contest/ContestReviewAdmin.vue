<template>
  <div>
    <Panel shadow>
      <div slot="title">Contest Reviews Management</div>
      <div slot="extra">
        <Tag
          :color="
            reviewStats.average_rating >= 7
              ? 'green'
              : reviewStats.average_rating >= 5
              ? 'orange'
              : 'red'
          "
        >
          Average Rating: {{ reviewStats.average_rating }}/10
        </Tag>
        <Tag type="border" style="margin-left: 8px">
          Total Reviews: {{ reviewStats.total_reviews }}
        </Tag>
      </div>

      <!-- Filters -->
      <div class="filter-row">
        <div class="filter-item">
          <span>Rating Filter:</span>
          <Select
            v-model="ratingFilter"
            placeholder="All Ratings"
            style="width: 120px"
          >
            <Option value="">All Ratings</Option>
            <Option value="high">8-10 (High)</Option>
            <Option value="medium">5-7 (Medium)</Option>
            <Option value="low">1-4 (Low)</Option>
          </Select>
        </div>
        <div class="filter-item">
          <span>Technical Issues:</span>
          <Select
            v-model="technicalIssuesFilter"
            placeholder="All"
            style="width: 120px"
          >
            <Option value="">All</Option>
            <Option value="true">Yes</Option>
            <Option value="false">No</Option>
          </Select>
        </div>
        <Button @click="loadReviews" type="primary" icon="ios-search"
          >Apply Filters</Button
        >
      </div>

      <!-- Reviews Table -->
      <Table
        :columns="columns"
        :data="reviews"
        :loading="loading"
        @on-row-click="showReviewDetail"
        class="review-table"
      >
        <template slot-scope="{ row }" slot="rating">
          <div class="rating-cell">
            <Rate v-model="row.rating" disabled show-text></Rate>
            <span class="rating-number">{{ row.rating }}/10</span>
          </div>
        </template>

        <template slot-scope="{ row }" slot="category_ratings">
          <div class="category-ratings">
            <Tag
              v-for="(rating, category) in row.category_ratings"
              :key="category"
              :color="getCategoryColor(rating)"
              size="small"
            >
              {{ formatCategoryName(category) }}: {{ rating }}
            </Tag>
          </div>
        </template>

        <template slot-scope="{ row }" slot="technical_issues">
          <Tag :color="row.had_technical_issues ? 'red' : 'green'">
            {{ row.had_technical_issues ? "Yes" : "No" }}
          </Tag>
        </template>

        <template slot-scope="{ row }" slot="actions">
          <Button
            type="primary"
            size="small"
            @click.stop="showReviewDetail(row)"
          >
            <Icon type="ios-eye"></Icon> View Detail
          </Button>
        </template>
      </Table>

      <!-- Pagination -->
      <div style="margin-top: 20px; text-align: right" v-if="total > limit">
        <Page
          :total="total"
          :page-size="limit"
          :current="page"
          @on-change="changePage"
          show-sizer
          @on-page-size-change="changeLimit"
        ></Page>
      </div>
    </Panel>

    <!-- Review Detail Modal -->
    <Modal
      v-model="showDetailModal"
      :title="`Review by ${selectedReview.username}`"
      width="800"
      :mask-closable="false"
    >
      <div v-if="selectedReview.id" class="review-detail">
        <!-- Header Info -->
        <div class="review-header">
          <div class="review-meta">
            <p>
              <strong>User:</strong> {{ selectedReview.username }} (ID:
              {{ selectedReview.user_id }})
            </p>
            <p>
              <strong>Submitted:</strong>
              {{ formatDate(selectedReview.submitted_at) }}
            </p>
            <p>
              <strong>Last Updated:</strong>
              {{ formatDate(selectedReview.updated_at) }}
            </p>
            <p>
              <strong>IP Address:</strong>
              {{ selectedReview.ip_address || "N/A" }}
            </p>
          </div>
          <div class="overall-rating">
            <h3>Overall Rating</h3>
            <Rate v-model="selectedReview.rating" disabled show-text></Rate>
            <span class="rating-text">{{ selectedReview.rating }}/10</span>
          </div>
        </div>

        <!-- Category Ratings -->
        <div class="category-section">
          <h3>Category Ratings</h3>
          <div class="category-grid">
            <div class="category-section">
              <h3>Category Ratings</h3>
              <div class="category-grid">
                <div
                  v-for="(rating, category) in selectedReview.category_ratings"
                  :key="category"
                  class="category-item"
                >
                  <div class="category-name">
                    {{ formatCategoryName(category) }}
                  </div>
                  <div class="category-rating">
                    <Rate :value="rating" disabled></Rate>
                    <span>{{ rating }}/5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Review Text -->
        <div class="review-text-section">
          <h3>Review Comments</h3>
          <div class="review-text">
            {{ selectedReview.review_text }}
          </div>
        </div>

        <!-- Technical Issues -->
        <div
          class="technical-issues-section"
          v-if="selectedReview.had_technical_issues"
        >
          <h3>Technical Issues</h3>
          <Alert type="warning" show-icon>
            <div slot="desc">
              {{
                selectedReview.technical_issues_detail ||
                "User reported technical issues but did not provide details."
              }}
            </div>
          </Alert>
        </div>
      </div>

      <div slot="footer">
        <Button @click="showDetailModal = false">Close</Button>
      </div>
    </Modal>
  </div>
</template>

<script>
import api from "@oj/api";
import time from "@/utils/time";

export default {
  name: "ContestReviewAdmin",
  data() {
    return {
      loading: false,
      reviews: [],
      reviewStats: {
        total_reviews: 0,
        average_rating: 0,
      },
      columns: [
        {
          title: "User",
          key: "username",
          width: 120,
        },
        {
          title: "Overall Rating",
          key: "rating", // Use key instead of slot
          width: 200,
          render: (h, params) => {
            return h("div", { class: "rating-cell" }, [
              h("Rate", {
                props: {
                  value: params.row.rating,
                  disabled: true,
                  "show-text": true,
                },
              }),
              h(
                "span",
                { class: "rating-number", style: { marginLeft: "8px" } },
                `${params.row.rating}/10`
              ),
            ]);
          },
        },
        {
          title: "Category Ratings",
          key: "category_ratings", // Use key instead of slot
          width: 300,
          render: (h, params) => {
            const tags = Object.entries(params.row.category_ratings).map(
              ([category, rating]) => {
                return h(
                  "Tag",
                  {
                    props: {
                      color: this.getCategoryColor(rating),
                      size: "small",
                    },
                    style: {
                      margin: "2px",
                    },
                  },
                  `${this.formatCategoryName(category)}: ${rating}`
                );
              }
            );
            return h("div", { class: "category-ratings" }, tags);
          },
        },
        {
          title: "Technical Issues",
          key: "had_technical_issues", // Use key instead of slot
          width: 130,
          align: "center",
          render: (h, params) => {
            const hadIssues = params.row.had_technical_issues;
            return h(
              "Tag",
              {
                props: {
                  color: hadIssues ? "red" : "green",
                },
              },
              hadIssues ? "Yes" : "No"
            );
          },
        },
        {
          title: "Submitted",
          key: "submitted_at",
          width: 160,
          render: (h, params) => {
            return h(
              "span",
              time.utcToLocal(params.row.submitted_at, "YYYY-MM-DD HH:mm")
            );
          },
        },
        {
          title: "Actions",
          key: "actions", // Use key instead of slot
          width: 120,
          align: "center",
          render: (h, params) => {
            return h(
              "Button",
              {
                props: {
                  type: "primary",
                  size: "small",
                  icon: "ios-eye",
                },
                on: {
                  click: (event) => {
                    event.stopPropagation(); // This prevents the on-row-click from firing
                    this.showReviewDetail(params.row);
                  },
                },
              },
              "View Detail"
            );
          },
        },
      ],
      // Pagination
      page: 1,
      limit: 20,
      total: 0,
      // Filters
      ratingFilter: "",
      technicalIssuesFilter: "",
      // Modal
      showDetailModal: false,
      selectedReview: {},
    };
  },
  mounted() {
    this.loadReviews();
    this.loadReviewStats();
  },
  methods: {
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
        console.log("Calling admin API with filters:", filters);

        // Call the admin-specific API method directly
        const res = await api.getContestReviewListAdmin(
          this.$route.params.contestID,
          offset,
          this.limit,
          filters
        );

        console.log("API Response:", res.data);

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

    async loadReviewStats() {
      try {
        console.log(
          "Loading review stats for contest:",
          this.$route.params.contestID
        );

        // Call the admin-specific stats API method directly
        const res = await api.getContestReviewStatsAdmin(
          this.$route.params.contestID
        );

        console.log("Stats API Response:", res.data);
        this.reviewStats = res.data.data;
      } catch (err) {
        this.$error("Failed to load review stats");
        console.error("Failed to load review stats:", err);
      }
    },

    showReviewDetail(row) {
      this.selectedReview = { ...row };
      this.showDetailModal = true;
    },

    changePage(page) {
      this.page = page;
      this.loadReviews();
    },

    changeLimit(limit) {
      this.limit = limit;
      this.page = 1;
      this.loadReviews();
    },

    formatDate(dateStr) {
      return time.utcToLocal(dateStr, "YYYY-MM-DD HH:mm:ss");
    },

    formatCategoryName(category) {
      return category
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l) => l.toUpperCase());
    },

    getCategoryColor(rating) {
      if (rating >= 4) return "green";
      if (rating >= 3) return "orange";
      return "red";
    },
  },
};
</script>

<style scoped lang="less">
.filter-row {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 20px;

  .filter-item {
    display: flex;
    align-items: center;
    gap: 8px;

    span {
      font-weight: 500;
      white-space: nowrap;
    }
  }
}

.review-table {
  .rating-cell {
    display: flex;
    align-items: center;
    gap: 8px;

    .rating-number {
      font-weight: 600;
      color: #2d8cf0;
    }
  }

  .category-ratings {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}

.review-detail {
  .review-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e8eaec;

    .review-meta p {
      margin: 4px 0;
      color: #666;
    }

    .overall-rating {
      text-align: center;

      h3 {
        margin-bottom: 8px;
      }

      .rating-text {
        margin-left: 8px;
        font-size: 18px;
        font-weight: 600;
        color: #2d8cf0;
      }
    }
  }

  .category-section {
    margin-bottom: 24px;

    h3 {
      margin-bottom: 12px;
    }

    .category-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }

    .category-item {
      padding: 12px;
      border: 1px solid #e8eaec;
      border-radius: 4px;

      .category-name {
        font-weight: 500;
        margin-bottom: 8px;
        color: #333;
      }

      .category-rating {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }

  .review-text-section {
    margin-bottom: 24px;

    h3 {
      margin-bottom: 12px;
    }

    .review-text {
      background: #f8f8f9;
      padding: 16px;
      border-radius: 4px;
      border-left: 4px solid #2d8cf0;
      line-height: 1.6;
      font-size: 14px;
    }
  }

  .technical-issues-section {
    h3 {
      margin-bottom: 12px;
    }
  }
}
</style>
