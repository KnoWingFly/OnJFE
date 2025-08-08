<template>
  <div class="contest-review-container">
    <Panel :padding="20" shadow>
      <div slot="title">
        <Icon type="ios-star"></Icon>
        {{ $t("m.Website_Review") }}
      </div>
      <div slot="extra">
        <Tag v-if="reviewSubmitted" type="dot" color="success">
          {{ $t("m.Review_Submitted") }}
        </Tag>
        <Tag v-else type="dot" color="warning">
          {{ $t("m.Review_Required") }}
        </Tag>
      </div>

      <div class="review-form" v-if="!reviewSubmitted || editMode">
        <div class="review-section">
          <h3>{{ $t("m.Rate_Website") }}</h3>
          <p class="review-description">
            {{ $t("m.Review_Description") }}
          </p>

          <div class="rating-section">
            <label class="rating-label">
              {{ $t("m.Overall_Rating") }}
              <span class="required">*</span>
            </label>
            <div class="star-rating">
              <Icon
                v-for="star in 10"
                :key="star"
                :type="star <= currentRating ? 'ios-star' : 'ios-star-outline'"
                :class="[
                  'star',
                  { active: star <= currentRating, hover: star <= hoverRating },
                ]"
                @click="setRating(star)"
                @mouseenter="hoverRating = star"
                @mouseleave="hoverRating = 0"
              ></Icon>
              <span class="rating-text">{{ currentRating }}/10</span>
            </div>
          </div>

          <div class="category-ratings">
            <h4>{{ $t("m.Category_Ratings") }}</h4>

            <div
              class="category-item"
              v-for="category in categories"
              :key="category.key"
            >
              <label class="category-label">{{ category.name }}</label>
              <div class="mini-star-rating">
                <Icon
                  v-for="star in 5"
                  :key="star"
                  :type="
                    star <= (categoryRatings[category.key] || 0)
                      ? 'ios-star'
                      : 'ios-star-outline'
                  "
                  :class="[
                    'mini-star',
                    { active: star <= (categoryRatings[category.key] || 0) },
                  ]"
                  @click="setCategoryRating(category.key, star)"
                ></Icon>
                <span class="mini-rating-text"
                  >{{ categoryRatings[category.key] || 0 }}/5</span
                >
              </div>
            </div>
          </div>

          <div class="text-review-section">
            <label class="review-label">
              {{ $t("m.Written_Review") }}
              <span class="required">*</span>
            </label>
            <Input
              v-model="reviewText"
              type="textarea"
              :rows="6"
              :placeholder="$t('m.Review_Placeholder')"
              :maxlength="1000"
              show-word-limit
              class="review-textarea"
            />
          </div>

          <div class="additional-questions">
            <h4>{{ $t("m.Additional_Questions") }}</h4>

            <div class="question-item">
              <label>{{ $t("m.Technical_Issues") }}</label>
              <RadioGroup v-model="hadTechnicalIssues" class="issues-radio">
                <Radio :label="false">{{ $t("m.No_Issues") }}</Radio>
                <Radio :label="true">{{ $t("m.Some_Issues") }}</Radio>
              </RadioGroup>
            </div>

            <div v-if="hadTechnicalIssues" class="technical-issues-detail">
              <Input
                v-model="technicalIssuesDetail"
                type="textarea"
                :rows="3"
                :placeholder="$t('m.Describe_Issues')"
                :maxlength="500"
                show-word-limit
              />
            </div>
          </div>

          <div class="submit-section">
            <Button
              type="primary"
              size="large"
              :loading="submitting"
              :disabled="!canSubmit"
              @click="submitReview"
              class="submit-button"
            >
              <Icon type="ios-checkmark-circle"></Icon>
              {{
                reviewSubmitted ? $t("m.Update_Review") : $t("m.Submit_Review")
              }}
            </Button>
            <Button
              v-if="reviewSubmitted && editMode"
              @click="cancelEdit"
              class="cancel-button"
            >
              {{ $t("m.Cancel") }}
            </Button>
          </div>
        </div>
      </div>

      <div class="review-display" v-else-if="reviewSubmitted && !editMode">
        <div class="submitted-review">
          <div class="review-header">
            <div class="overall-rating">
              <span class="rating-number">{{ submittedReview.rating }}</span>
              <div class="stars-display">
                <Icon
                  v-for="star in 10"
                  :key="star"
                  :type="
                    star <= submittedReview.rating
                      ? 'ios-star'
                      : 'ios-star-outline'
                  "
                  class="display-star"
                ></Icon>
              </div>
              <span class="rating-label">out of 10</span>
            </div>
            <div class="review-actions">
              <Button type="text" size="small" @click="enableEditMode">
                <Icon type="ios-create"></Icon>
                {{ $t("m.Edit_Review") }}
              </Button>
            </div>
          </div>

          <div class="category-display" v-if="submittedReview.category_ratings">
            <h4>{{ $t("m.Category_Ratings") }}</h4>
            <div class="category-grid">
              <div
                v-for="(rating, key) in submittedReview.category_ratings"
                :key="key"
                class="category-display-item"
              >
                <span class="category-name">{{ getCategoryName(key) }}</span>
                <div class="category-stars">
                  <Icon
                    v-for="star in 5"
                    :key="star"
                    :type="star <= rating ? 'ios-star' : 'ios-star-outline'"
                    class="category-display-star"
                  ></Icon>
                  <span class="category-rating">{{ rating }}/5</span>
                </div>
              </div>
            </div>
          </div>

          <div class="review-text-display">
            <h4>{{ $t("m.Your_Review") }}</h4>
            <div class="review-content">{{ submittedReview.review_text }}</div>
          </div>

          <div class="review-metadata">
            <div class="review-info">
              <Icon type="ios-time"></Icon>
              {{ $t("m.Submitted_At") }}:
              {{ formatTime(submittedReview.submitted_at) }}
            </div>
          </div>
        </div>
      </div>
      <div
        class="penalty-warning"
        v-if="!reviewSubmitted && showPenaltyWarning"
      >
        <Alert type="warning" show-icon>
          <Icon type="ios-warning" slot="icon"></Icon>
          <strong>{{ $t("m.Review_Required_Warning") }}</strong>
          <div slot="desc">
            {{ $t("m.Penalty_Warning") }}
          </div>
        </Alert>
      </div>

      <div class="success-message" v-if="showSuccessMessage">
        <Alert
          type="success"
          show-icon
          closable
          @on-close="showSuccessMessage = false"
        >
          <Icon type="ios-checkmark-circle" slot="icon"></Icon>
          {{ $t("m.Review_Submitted_Success") }}
        </Alert>
      </div>
    </Panel>
  </div>
</template>

<script>
import moment from "moment";
import api from "@oj/api";

export default {
  name: "ContestReview",
  data() {
    return {
      // Rating data
      currentRating: 0,
      hoverRating: 0,
      reviewText: "",
      categoryRatings: {},
      hadTechnicalIssues: false,
      technicalIssuesDetail: "",

      // State management
      submitting: false,
      reviewSubmitted: false,
      editMode: false,
      submittedReview: null,
      showSuccessMessage: false,
      showPenaltyWarning: true,

      // Categories for detailed rating
      categories: [
        { key: "user_interface", name: this.$t("m.User_Interface") },
        { key: "performance", name: this.$t("m.Performance") },
        { key: "problem_quality", name: this.$t("m.Problem_Quality") },
        { key: "judging_accuracy", name: this.$t("m.Judging_Accuracy") },
      ],
    };
  },
  computed: {
    contestID() {
      return this.$route.params.contestID;
    },
    canSubmit() {
      return this.currentRating > 0 && this.reviewText.trim().length >= 10;
    },
  },
  mounted() {
    this.loadExistingReview();
  },
  methods: {
    setRating(rating) {
      this.currentRating = rating;
    },

    setCategoryRating(category, rating) {
      this.$set(this.categoryRatings, category, rating);
    },

    getCategoryName(key) {
      const category = this.categories.find((cat) => cat.key === key);
      return category ? category.name : key;
    },

    async loadExistingReview() {
      try {
        const response = await api.getContestReview(this.contestID);

        if (response.data.data) {
          this.submittedReview = response.data.data;
          this.reviewSubmitted = true;
          this.populateFormWithExistingReview();
          this.showPenaltyWarning = false;
        }
      } catch (error) {
        console.log("No existing review found or error loading review:", error);
      }
    },

    populateFormWithExistingReview() {
      if (this.submittedReview) {
        this.currentRating = this.submittedReview.rating;
        this.reviewText = this.submittedReview.review_text;
        this.categoryRatings = { ...this.submittedReview.category_ratings };
        this.hadTechnicalIssues = this.submittedReview.had_technical_issues;
        this.technicalIssuesDetail =
          this.submittedReview.technical_issues_detail || "";
      }
    },

    async submitReview() {
      if (!this.canSubmit) {
        this.$error(this.$t("m.Please_Complete_Required_Fields"));
        return;
      }

      this.submitting = true;

      try {
        const reviewData = {
          contest_id: this.contestID,
          rating: this.currentRating,
          review_text: this.reviewText.trim(),
          category_ratings: this.categoryRatings,
          had_technical_issues: this.hadTechnicalIssues,
          technical_issues_detail: this.technicalIssuesDetail.trim(),
        };

        const response = await api.submitContestReview(reviewData);

        if (response.data.error === null) {
          this.submittedReview = response.data.data.review;
          this.reviewSubmitted = true;
          this.editMode = false;
          this.showSuccessMessage = true;
          this.showPenaltyWarning = false;

          this.$success(response.data.data.message);
        } else {
          this.$error(response.data.data || "Error submitting review");
        }
      } catch (error) {
        console.error("Error submitting review:", error);
        this.$error(
          (error.response &&
            error.response.data &&
            error.response.data.data) ||
            this.$t("m.Review_Submit_Error")
        );
      } finally {
        this.submitting = false;
      }
    },

    enableEditMode() {
      this.editMode = true;
      this.populateFormWithExistingReview();
    },

    cancelEdit() {
      this.editMode = false;
      // Reset form to submitted values
      this.populateFormWithExistingReview();
    },

    formatTime(timeStr) {
      return moment(timeStr).format("MMM DD, YYYY HH:mm");
    },
  },
};
</script>

<style scoped lang="less">
.contest-review-container {
  margin-bottom: 20px;
}

.review-form {
  .review-section {
    h3 {
      color: #2d8cf0;
      margin-bottom: 10px;
      font-size: 18px;
    }

    .review-description {
      color: #657180;
      margin-bottom: 25px;
      line-height: 1.5;
    }
  }
}

.rating-section {
  margin-bottom: 30px;

  .rating-label {
    display: block;
    margin-bottom: 10px;
    font-weight: 500;
    color: #515a6e;

    .required {
      color: #ed4014;
      margin-left: 4px;
    }
  }

  .star-rating {
    display: flex;
    align-items: center;
    gap: 4px;

    .star {
      font-size: 24px;
      color: #dcdee2;
      cursor: pointer;
      transition: color 0.2s;

      &.active {
        color: #f5a623;
      }

      &.hover {
        color: #f5a623;
      }

      &:hover {
        color: #f5a623;
      }
    }

    .rating-text {
      margin-left: 10px;
      font-weight: 500;
      color: #515a6e;
    }
  }
}

.category-ratings {
  margin-bottom: 30px;

  h4 {
    color: #515a6e;
    margin-bottom: 15px;
  }

  .category-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #f8f8f9;

    &:last-child {
      border-bottom: none;
    }

    .category-label {
      font-weight: 500;
      color: #515a6e;
      flex: 1;
    }

    .mini-star-rating {
      display: flex;
      align-items: center;
      gap: 2px;

      .mini-star {
        font-size: 16px;
        color: #dcdee2;
        cursor: pointer;
        transition: color 0.2s;

        &.active {
          color: #f5a623;
        }

        &:hover {
          color: #f5a623;
        }
      }

      .mini-rating-text {
        margin-left: 8px;
        font-size: 12px;
        color: #80848f;
        min-width: 30px;
      }
    }
  }
}

.text-review-section {
  margin-bottom: 30px;

  .review-label {
    display: block;
    margin-bottom: 8px;
    font-weight: 500;
    color: #515a6e;

    .required {
      color: #ed4014;
      margin-left: 4px;
    }
  }

  .review-textarea {
    font-size: 14px;
  }
}

.additional-questions {
  margin-bottom: 30px;

  h4 {
    color: #515a6e;
    margin-bottom: 15px;
  }

  .question-item {
    margin-bottom: 20px;

    label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
      color: #515a6e;
    }

    .recommend-radio,
    .issues-radio {
      margin-left: 0;
    }
  }

  .technical-issues-detail {
    margin-top: 10px;
    padding-left: 20px;
  }
}

.submit-section {
  display: flex;
  gap: 10px;
  justify-content: flex-start;
  margin-top: 30px;

  .submit-button {
    min-width: 150px;
  }
}

.penalty-warning {
  margin-top: 20px;
}

.success-message {
  margin-top: 15px;
}

// Review Display Styles
.review-display {
  .submitted-review {
    .review-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 25px;
      padding-bottom: 15px;
      border-bottom: 1px solid #e8eaec;

      .overall-rating {
        display: flex;
        align-items: center;
        gap: 10px;

        .rating-number {
          font-size: 32px;
          font-weight: bold;
          color: #f5a623;
        }

        .stars-display {
          display: flex;
          gap: 2px;

          .display-star {
            font-size: 18px;
            color: #dcdee2;

            &[type="ios-star"] {
              color: #f5a623;
            }
          }
        }

        .rating-label {
          color: #80848f;
          font-size: 14px;
        }
      }
    }

    .category-display {
      margin-bottom: 25px;

      h4 {
        color: #515a6e;
        margin-bottom: 15px;
      }

      .category-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 15px;

        .category-display-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          background: #f8f8f9;
          border-radius: 4px;

          .category-name {
            font-size: 13px;
            color: #515a6e;
          }

          .category-stars {
            display: flex;
            align-items: center;
            gap: 2px;

            .category-display-star {
              font-size: 12px;
              color: #dcdee2;

              &[type="ios-star"] {
                color: #f5a623;
              }
            }

            .category-rating {
              margin-left: 5px;
              font-size: 11px;
              color: #80848f;
            }
          }
        }
      }
    }

    .review-text-display {
      margin-bottom: 20px;

      h4 {
        color: #515a6e;
        margin-bottom: 10px;
      }

      .review-content {
        background: #f8f8f9;
        padding: 15px;
        border-radius: 4px;
        line-height: 1.6;
        color: #515a6e;
        white-space: pre-wrap;
      }
    }

    .review-metadata {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 15px;
      border-top: 1px solid #e8eaec;

      .review-info,
      .recommend-info {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 13px;
        color: #80848f;

        i {
          font-size: 14px;
        }
      }
    }
  }
}

// Responsive design
@media (max-width: 768px) {
  .category-grid {
    grid-template-columns: 1fr !important;
  }

  .review-header {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 15px;
  }

  .review-metadata {
    flex-direction: column;
    align-items: flex-start !important;
    gap: 10px;
  }

  .star-rating {
    flex-wrap: wrap;
  }
}
</style>