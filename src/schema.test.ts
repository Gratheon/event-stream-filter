import { graphql } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import gql from 'gql-tag';

describe('GraphQL Schema', () => {
  // Create a minimal schema for testing without dependencies
  const typeDefs = gql`
    scalar JSON
    type Query {
      hello: String
    }
    type Subscription {
      onApiaryUpdated: ApiaryEvent
    }
    type ApiaryEvent {
      id: String
      name: String
    }
  `;

  const resolvers = {
    Query: {
      hello: () => 'Hello World!',
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });

  it('should create schema without errors', () => {
    expect(schema).toBeDefined();
  });

  it('should execute hello query', async () => {
    const query = `
      query {
        hello
      }
    `;

    const result = await graphql({ schema, source: query });
    expect(result.errors).toBeUndefined();
    expect(result.data?.hello).toBe('Hello World!');
  });

  it('should have correct types defined', () => {
    const typeMap = schema.getTypeMap();
    expect(typeMap.Query).toBeDefined();
    expect(typeMap.Subscription).toBeDefined();
    expect(typeMap.ApiaryEvent).toBeDefined();
    expect(typeMap.JSON).toBeDefined();
  });

  it('should have all subscription types', () => {
    const subscriptionType = schema.getSubscriptionType();
    expect(subscriptionType).toBeDefined();
    
    const fields = subscriptionType?.getFields();
    expect(fields?.onApiaryUpdated).toBeDefined();
  });
});
