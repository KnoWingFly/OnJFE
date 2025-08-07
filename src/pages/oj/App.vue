<template>
  <div>
    <!-- Hide navbar when anti-cheat is active -->
    <NavBar v-show="!antiCheatActive"></NavBar>
    <div class="content-app" :class="{ 'anti-cheat-mode': antiCheatActive }">
      <transition name="fadeInUp" mode="out-in">
        <router-view></router-view>
      </transition>
      <!-- Hide footer when anti-cheat is active -->
      <div class="footer" v-show="!antiCheatActive">
        <p v-html="website.website_footer"></p>
        <p>Powered by <a href="https://github.com/QingdaoU/OnlineJudge">OnlineJudge</a>
          <span v-if="version">&nbsp; Version: {{ version }}</span>
        </p>
      </div>
    </div>
    <BackTop v-show="!antiCheatActive"></BackTop>
  </div>
</template>

<script>
  import { mapActions, mapState, mapGetters } from 'vuex'
  import NavBar from '@oj/components/NavBar.vue'

  export default {
    name: 'app',
    components: {
      NavBar
    },
    data () {
      return {
        version: process.env.VERSION
      }
    },
    created () {
      try {
        document.body.removeChild(document.getElementById('app-loader'))
      } catch (e) {
      }
    },
    mounted () {
      this.getWebsiteConfig()
    },
    methods: {
      ...mapActions(['getWebsiteConfig', 'changeDomTitle'])
    },
    computed: {
      ...mapState(['website']),
      ...mapGetters(['antiCheatActive'])
    },
    watch: {
      'website' () {
        this.changeDomTitle()
      },
      '$route' () {
        this.changeDomTitle()
      }
    }
  }
</script>

<style lang="less">
  * {
    -webkit-box-sizing: border-box;
    -moz-box-sizing: border-box;
    box-sizing: border-box;
  }

  a {
    text-decoration: none;
    background-color: transparent;
    &:active, &:hover {
      outline-width: 0;
    }
  }

  @media screen and (max-width: 1200px) {
    .content-app {
      margin-top: 160px;
      padding: 0 2%;
      
      &.anti-cheat-mode {
        margin-top: 0 !important;
        padding: 0 !important;
      }
    }
  }

  @media screen and (min-width: 1200px) {
    .content-app {
      margin-top: 80px;
      padding: 0 2%;
      
      &.anti-cheat-mode {
        margin-top: 0 !important;
        padding: 0 !important;
      }
    }
  }

  .footer {
    margin-top: 20px;
    margin-bottom: 10px;
    text-align: center;
    font-size: small;
  }

  .fadeInUp-enter-active {
    animation: fadeInUp .8s;
  }
.cheat-warning-modal {
  z-index: 100000 !important;
  
  &.ivu-modal-wrap {
    z-index: 100000 !important;
    position: fixed !important;
  }
  
  .ivu-modal {
    z-index: 100000 !important;
  }
  
  .ivu-modal-mask {
    z-index: 99999 !important;
    background: rgba(0, 0, 0, 0.8) !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
  }
}

// Ensure anti-cheat mode doesn't interfere
.anti-cheat-mode {
  position: fixed !important;
  top: 0 !important;
  left: 0 !important;
  right: 0 !important;
  bottom: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  overflow: auto !important;
  z-index: 9999 !important; // Lower than modal
  background: #fff !important;
}

</style>