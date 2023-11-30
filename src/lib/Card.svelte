<script>
  import Card, { Content, Actions } from "@smui/card";
  import Button, { Label } from "@smui/button";
  import Chip, { Set, Text } from "@smui/chips";

  export let categories;
  export let joke;
  export let id;
  export let likeJoke;
  export let dislikeJoke;
  export let i;
</script>

<style>
  .card-container {
    display: block;
    margin: auto;
    width: 100%;
    background-color: #f8f8f8;
    margin-bottom: 20px;
  }
</style>

<div class="card-container">
  <Card id={`joke-${i}`}>
    <Content>
      <div>
        <Set
          chips={categories.length > 0 ? [...categories] : ['regular']}
          let:chip>
          <Chip>
            <Text>{chip}</Text>
          </Chip>
        </Set>
      </div>

      <div class="mdc-typography--body2">{joke}</div>
    </Content>
    <Actions>
      <Button variant="raised" on:click={() => likeJoke(id)}>
        <Label>Like</Label>
      </Button>
      <Button
        variant="raised"
        color="secondary"
        on:click={() => dislikeJoke(id)}>
        <Label>Dsilike</Label>
      </Button>
    </Actions>
  </Card>
</div>
