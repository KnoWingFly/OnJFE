<template>
  <div class="contest-review-page">
    <ContestReview />
  </div>
</template>

<script>
import ContestReview from './ContestReview.vue' // Import the review component we created

export default {
  name: 'ContestReviewPage',
  components: {
    ContestReview
  },
  data() {
    return {}
  },
  mounted() {
    // Any page-level initialization can go here
    console.log('Contest Review Page mounted for contest:', this.$route.params.contestID)
  }
}
</script>

<style scoped lang="less">
.contest-review-page {
  padding: 0;
  margin: 0;
  
  // Ensure the review component takes full width
  width: 100%;
}
</style>