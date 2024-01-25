import Component from "@glimmer/component";
import { inject as service } from "@ember/service";
import { action } from "@ember/object";
import { tracked } from "@glimmer/tracking";
import { defaultHomepage } from "discourse/lib/utilities";
import I18n from "I18n";
import Category from "discourse/models/category";

const FEATURED_CLASS = "featured-homepage-topics";

export default class FeaturedHomepageTopics extends Component {
  @service router;
  @service store;
  @service siteSettings;
  @service currentUser;
  @service keyValueStore;

  @tracked numSet = 0;
  @tracked shuffle = 0;
  @tracked featuredTagTopics = null;
  @tracked toggleTopics = this.keyValueStore.getItem("toggleTopicsState") === "true" || false;

  constructor() {
    super(...arguments);
    if (settings.config_output) {
      this.configOutput();
    }
    this.startClock();
    this.router.on("routeDidChange", this.checkShowHere);
  }

  async configOutput() {
    const sortOrder = settings.sort_by_created ? "created" : "activity";
    const topicList = await this.store.findFiltered("topicList", {
      filter: "latest",
      params: {
        tags: [`${settings.featured_tag}`],
        order: sortOrder,
      },
    });

    const featuredTopics = topicList.topics
      .filter(
        (topic) =>
          topic.image_url && (!settings.hide_closed_topics || !topic.closed)
      );

    var tc = settings.topic_configuration.split('|');
    tc.forEach(row => {
      var ids = row.split(',').map(id => parseInt(id, 10));
      ids.forEach(id => {
        const topic = featuredTopics.find(topic => topic.id === id);
        if (topic) {
            console.log("Topic "+ id+ ": ok");
        } else {
            console.log("Topic "+ id+ ": something wrong");
        }
      });
    });
    var t = (new Date()).getTime();
    var currentSet = settings.adjust_rows + Math.floor(t / (1000 * settings.change_interval));
    console.log("current set is #" + (1 + (currentSet % tc.length)) + " of " + tc.length);
    var currentFloor = Math.floor(t / (1000 * settings.change_interval));
    var nextIncrement = (currentFloor + 1) * (1000 * settings.change_interval);
    var nextIncrementTime = new Date(nextIncrement);
    console.log("Current time:        " + (new Date()).toString());
    console.log("Next increment time: " + nextIncrementTime.toString());
  }

  startClock() {
    this.timer = setInterval(() => {
      var t = (new Date()).getTime();
      var newSet = settings.adjust_rows + Math.floor(t / (1000 * settings.change_interval));
      var shuffle = Math.floor(t / (1000 * settings.shuffle_interval));
      if (newSet != this.numSet) {
        this.numSet = newSet;
        this.shuffle = shuffle;
        this.getBannerTopics();
      }
      else {
        if (shuffle != this.shuffle) {
          this.shuffle = shuffle;
          if ((this.featuredTagTopics) && (this.featuredTagTopics.length > 0)) {
            this.featuredTagTopics = [...this.featuredTagTopics.slice(1), this.featuredTagTopics[0]];
        }
        }
      }
    }
    , 1000);
  }

  @action
  toggle() {
    this.toggleTopics = !this.toggleTopics;
    this.keyValueStore.setItem("toggleTopicsState", this.toggleTopics);
  }

  willDestroy() {
    this.router.off("routeDidChange", this.checkShowHere);
    clearInterval(this.timer);
  }

  @action
  checkShowHere() {
    document.body.classList.toggle(FEATURED_CLASS, this.showHere);
  }

  get showHere() {
    const { currentRoute, currentRouteName } = this.router;

    if (currentRoute) {
      let category = currentRoute.params.category_slug_path_with_id ?
        Category.findBySlugPathWithID(currentRoute.params.category_slug_path_with_id) : null;

      if (category && category.id) {
        console.log(category);
        if (settings.show_on_category_ids.split('|').map(Number).includes(category.id)) {
          return true;
        }
      }
      switch (settings.show_on) {
        case "homepage":
          return currentRouteName === `discovery.${defaultHomepage()}`;
        case "top_menu":
          const topMenuRoutes = this.siteSettings.top_menu
            .split("|")
            .filter(Boolean);
          return topMenuRoutes.includes(currentRoute.localName);
        case "all":
          return !/editCategory|admin|full-page-search/.test(currentRouteName);
        case "category_only":
          return false;
        default:
          return false;
      }
    }

    return false;
  }

  get featuredTitle() {
    // falls back to setting for backwards compatibility
    return I18n.t(themePrefix("featured_topic_title")) || settings.title_text;
  }

  get showFor() {
    if (
      settings.show_for === "everyone" ||
      (settings.show_for === "logged_out" && !this.currentUser) ||
      (settings.show_for === "logged_in" && this.currentUser) ||
      (settings.show_for === "admin_only" && this.currentUser && this.currentUser.admin)
    ) {
      return true;
    } else {
      return false;
    }
  }

  get mobileStyle() {
    if (
      settings.show_all_always &&
      settings.mobile_style === "stacked_on_smaller_screens"
    ) {
      return "-mobile-stacked";
    } else if (settings.show_all_always) {
      return "-mobile-horizontal";
    } else {
      return;
    }
  }

  @action
  async getBannerTopics() {
    if (!settings.featured_tag) {
      return;
    }

    const sortOrder = settings.sort_by_created ? "created" : "activity";
    const topicList = await this.store.findFiltered("topicList", {
      filter: "latest",
      params: {
        tags: [`${settings.featured_tag}`],
        order: sortOrder,
      },
    });

    const featuredTopics = topicList.topics
      .filter(
        (topic) =>
          topic.image_url && (!settings.hide_closed_topics || !topic.closed)
      );

    if (settings.topic_configuration != "") {
      var filteredTopics = [];
      var tc = settings.topic_configuration.split('|');
      var i = this.numSet % tc.length;
      var ids = tc[i].split(',').map(id => parseInt(id, 10));

      ids.forEach(id => {
        const topic = featuredTopics.find(topic => topic.id === id);
        if (topic) {
            filteredTopics.push(topic);
        } else {
            console.log("Could not load topic #" + id + ", maybe it's closed or it does not have an image");
        }
      });

      this.featuredTagTopics = filteredTopics;
    }
  }
}
