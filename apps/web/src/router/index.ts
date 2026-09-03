import { createRouter, createWebHistory } from "vue-router";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/projects" },
    {
      path: "/projects",
      name: "projects",
      component: () => import("../views/ProjectHubView.vue"),
    },
    {
      path: "/project/:projectId",
      name: "project-workspace",
      component: () => import("../views/ProjectWorkspaceView.vue"),
    },
    {
      path: "/canvas/:projectId/:episodeId",
      name: "canvas",
      component: () => import("../views/CanvasView.vue"),
    },
    {
      path: "/library",
      name: "library",
      component: () => import("../views/LibraryView.vue"),
    },
    {
      path: "/settings",
      name: "settings",
      component: () => import("../views/SettingsView.vue"),
    },
    {
      path: "/skills",
      name: "skills",
      component: () => import("../views/SkillsView.vue"),
    },
    {
      path: "/actor-voices",
      name: "actor-voices",
      component: () => import("../views/ActorVoicesView.vue"),
    },
  ],
});

export default router;
