const ContestList = () => import(/* webpackChunkName: "contest" */ './ContestList.vue')
const ContestDetails = () => import(/* webpackChunkName: "contest" */ './ContestDetail.vue')
const ContestProblemList = () => import(/* webpackChunkName: "contest" */ './children/ContestProblemList.vue')
const ContestRank = () => import(/* webpackChunkName: "contest" */ './children/ContestRank.vue')
const ACMContestHelper = () => import(/* webpackChunkName: "contest" */ './children/ACMHelper.vue')

// 1. Re-add the import for the user review page
const ContestReviewPage = () => import(/* webpackChunkName: "contest" */ './ContestReviewPage.vue')

// 2. Keep the import for the admin review page
const ContestReviewAdmin = () => import(/* webpackChunkName: "contest" */ './ContestReviewAdmin.vue')

// 3. Export BOTH components
export {
  ContestDetails,
  ContestList,
  ContestProblemList,
  ContestRank,
  ACMContestHelper,
  ContestReviewPage, // It was missing from here
  ContestReviewAdmin
}
