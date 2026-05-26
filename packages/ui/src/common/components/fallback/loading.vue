<template>
  <motion.div
    :initial="{ transformOrigin: 'center' }"
    :transition="{ repeat: Infinity, duration: 1, ease: 'linear' }"
    :animate="{ rotate: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }">
    <Loader />
  </motion.div>
</template>

<script setup lang="ts" name="Loading">
  import { motion } from "motion-v";
  import { Loader } from "lucide-vue-next";
</script>

<style scoped lang="scss"></style>
