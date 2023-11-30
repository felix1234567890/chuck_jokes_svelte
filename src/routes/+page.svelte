<script>
  import { onMount, tick } from "svelte";
  import TopAppBar, { Row, Section, Title } from "@smui/top-app-bar";
  import Tab from "@smui/tab";
  import TabBar from "@smui/tab-bar";
  import Checkbox from "@smui/checkbox";
  import Chip, { Text } from "@smui/chips";
  import FormField from "@smui/form-field";
  import Card from "../lib/Card.svelte";
  let promise;
  let jokesArr;
  let jokesToShow;
  let likedJokes = [];
  let categories;
  let active = "Home";
  let selected;
  let loading = false;

  onMount(() => {
    const getJokes = async () => {
      const res = await fetch("https://api.icndb.com/jokes");
      const jokes = await res.json();
      if (res.ok) {
        jokesArr = jokes.value;
        jokesToShow = jokesArr.slice(0, 10);
        setTimeout(() => observeCard(jokesToShow), 100);
        const cat = await fetch("https://api.icndb.com/categories");
        const cats = await cat.json();
        categories = cats.value;
        selected = [...categories];
      } else {
        throw new Error(jokes);
      }
    };
    promise = getJokes();
  });
  const likeJoke = id => {
    if (likedJokes.find(joke => joke.id === id)) return;
    const likedJoke = jokesToShow.find(joke => joke.id === id);
    likedJokes = likedJokes.concat(likedJoke);
  };
  const dislikeJoke = id => {
    const newLikedJokes = likedJokes.filter(joke => joke.id !== id);
    likedJokes = newLikedJokes;
  };

  const observeCard = jokesToShow => {
    const bottomJokeIndex = `joke-${jokesToShow.length - 1}`;
    const bottomJoke = document.getElementById(bottomJokeIndex);
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting === true) {
          loading = true;
          setTimeout(() => {
            addMoreJokes();
          }, 600);
          observer.unobserve(bottomJoke);
        }
      },
      { threshold: 1 }
    );
    if (bottomJoke) {
      observer.observe(bottomJoke);
    }
  };
  const addMoreJokes = async () => {
    const updatedJokesToShow = jokesArr.slice(0, jokesToShow.length + 10);
    jokesToShow = updatedJokesToShow;
    await tick();
    loading = false;
    observeCard(jokesToShow);
  };
</script>

<style>
  .container {
    max-width: 1100px;
    width: 100%;
    margin: 0 auto;
    padding: 0 15px;
  }
  .loader {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    height: 100%;
    border: 12px solid #f3f3f3;
    border-top: 12px solid #3f51b5;
    border-radius: 50%;
    width: 80px;
    height: 80px;
    animation: spin 2s linear infinite;
  }
  .lower {
    position: static;
    margin: 0 auto;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>

<main class="container">
  <div
    class="mdc-typography--headline2"
    align="center"
    style="font-weight:500;margin-bottom:20px">
    Chuck Norris jokes
  </div>
  {#await promise}
    <div class="loader" />
  {:then}
    {#if jokesToShow}
      <div class="top-app-bar-container flexor">
        <TopAppBar variant="static" dense={true} style="margin-bottom:20px">
          <Row>
            <TabBar
              tabs={['Home', 'Likes']}
              let:tab
              bind:active
              style="margin-bottom:20px">
              <Section>
                <Tab {tab}>
                  {#if tab === 'Likes' && likedJokes.length > 0}
                    <Chip style="background-color:lightblue">
                      <Text>{likedJokes.length}</Text>
                    </Chip>
                  {/if}
                  <Title>{tab}</Title>
                </Tab>
              </Section>
            </TabBar>
          </Row>
        </TopAppBar>
      </div>

      {#if active === 'Home'}
        {#each categories as cat}
          <FormField>
            <Checkbox bind:group={selected} value={cat} />
            <span slot="label">{cat}</span>
          </FormField>
        {/each}
        {#each jokesToShow as joke, i (joke.id)}
          {#if joke.categories.length === 0}
            <Card {...joke} {i} {likeJoke} {dislikeJoke} />
          {:else}
            {#each joke.categories as category}
              {#if selected.includes(category) || joke.categories.length === 0}
                <Card {...joke} {i} {likeJoke} {dislikeJoke} />
              {/if}
            {/each}
          {/if}
        {/each}
        {#if loading}
          <div class="loader lower" />
        {/if}
      {:else}
        {#if likedJokes.length > 0}
          {#each categories as cat}
            <FormField>
              <Checkbox bind:group={selected} value={cat} />
              <span slot="label">{cat}</span>
            </FormField>
          {/each}
        {/if}
        {#each likedJokes as joke, i (joke.id)}
          {#if joke.categories.length === 0}
            <Card {...joke} {i} {likeJoke} {dislikeJoke} />
          {:else}
            {#each joke.categories as category}
              {#if selected.includes(category) || joke.categories.length === 0}
                <Card {...joke} {i} {likeJoke} {dislikeJoke} />
              {/if}
            {/each}
          {/if}
        {/each}
      {/if}
    {/if}
  {:catch error}
    <p>{error.message}</p>
  {/await}
</main>
