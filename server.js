const express = require("express");
const axios = require("axios");
const cron = require("node-cron");
require("dotenv").config();

const app = express();
app.use(express.json());

const SHOPIFY_STORE_URL = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const shopifyGraphQLEndpoint = `https://${SHOPIFY_STORE_URL}/admin/api/2024-01/graphql.json`;

// Function to get product by title
async function getProductByTitle(title) {
  const query = `
    {
      products(first: 1, query: "title:${title}") {
        edges {
          node {
            id
            title
            description
            vendor
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
            variants(first: 10) {
                edges {
                    node {
                        id
                        title
                        inventoryItem {
                            id
                        }
                    }
                }
            }
            metafields(namespace: "custom", first: 10) {
              edges {
                node {
                  id
                  key
                  value
                  type
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      shopifyGraphQLEndpoint,
      {
        query,
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );
    return response.data.data.products.edges[0].node;
  } catch (error) {
    console.error("Error fetching product by title:", error);
    throw error;
  }
}

// Function to get inventory item by id
async function getinventoryItemById(id) {
  const query = `
        {
            inventoryItem(id: "${id}") {
                id
                inventoryLevels(first: 1) {
                    edges {
                        node {
                            id
                            quantities(names: ["available", "incoming", "committed", "damaged", "on_hand", "quality_control", "reserved", "safety_stock"]) {
                                name
                                quantity
                            }
                        }
                    }
                } 
            }  
        }
    `;

  try {
    const response = await axios.post(
      shopifyGraphQLEndpoint,
      {
        query,
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.data.inventoryItem.inventoryLevels.edges[0].node;
  } catch (error) {
    console.error("Error fetching product by title:", error);
    throw error;
  }
}

// Function to get inventory items by vendor
async function getInventoryItemsByVendor(vendor) {
  const query = `
    {
      products(first: 50, query: "vendor:${vendor}") {
        edges {
          node {
            title
            variants(first: 10) {
              edges {
                node {
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      shopifyGraphQLEndpoint,
      {
        query,
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.data.products.edges;
  } catch (error) {
    console.error("Error fetching inventory items by vendor:", error);
    throw error;
  }
}

// Function to get inventory levels for inventory items
async function getInventoryLevelsByIds(inventoryItemIds) {
  let inventoryLevels = [];
  console.log(inventoryItemIds);
  for (const item of inventoryItemIds) {
    const query = `
      {
        inventoryItem(id: "${item.itemId}") {
          id
          inventoryLevels(first: 1) {
            edges {
              node {
                id
                quantities(names: ["available", "incoming", "committed", "damaged", "on_hand", "quality_control", "reserved", "safety_stock"]) {
                  name
                  quantity
                }
              }
            }
          }
        }
      }
    `;

    try {
      const response = await axios.post(
        shopifyGraphQLEndpoint,
        {
          query,
        },
        {
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      if (
        response.data &&
        response.data.data &&
        response.data.data.inventoryItem &&
        response.data.data.inventoryItem.inventoryLevels.edges.length > 0
      ) {
        console.log(
          response.data.data.inventoryItem.inventoryLevels.edges[0].node
        );
        let inventoryLevelObj = {
          id: response.data.data.inventoryItem.inventoryLevels.edges[0].node.id,
          quantities:
            response.data.data.inventoryItem.inventoryLevels.edges[0].node
              .quantities,
          itemId: item.itemId,
          locationId: item.locationId,
        };
        inventoryLevels.push(inventoryLevelObj);
      }
    } catch (error) {
      console.error("Error fetching inventory levels by ids:", error);
      throw error;
    }
  }

  console.log(inventoryLevels);
  return inventoryLevels;
}

// Function to update inventory levels by ids
async function updateInventoryLevelsByIds(inventoryItems) {
  let inventoryLevels = [];
  for (const item of inventoryItems) {
    let input = {
      name: "available",
      reason: "correction",
      changes: [
        {
          delta: 1,
          inventoryItemId: item.itemId,
          locationId: item.locationId,
        },
      ],
    };
    const mutation = `mutation {
        inventoryAdjustQuantities(input: {
            name: "${input.name}",
            reason: "${input.reason}",
            changes: [
                {
                    delta: ${input.changes[0].delta},
                    inventoryItemId: "${input.changes[0].inventoryItemId}",
                    locationId: "${input.changes[0].locationId}"
                }
            ]
        })
        {
            userErrors {
                field
                message
            }
        }
    }`;

    console.log(mutation);

    try {
      const response = await axios.post(
        shopifyGraphQLEndpoint,
        {
          query: mutation,
        },
        {
          headers: {
            "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
            "Content-Type": "application/json",
          },
        }
      );

      console.log(response.data);
    } catch (error) {
      console.error("Error updating inventory levels by ids:", error);
      throw error;
    }
  }

  return inventoryLevels;
}

// Function to get location ids
async function getLocationIds() {
  const query = `
        {
        locations(first: 10) {
            edges {
            node {
                id
                name
            }
            }
        }
        }
    `;

  try {
    const response = await axios.post(
      shopifyGraphQLEndpoint,
      {
        query,
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.data.locations.edges;
  } catch (error) {
    console.error("Error fetching locations:", error);
    throw error;
  }
}

// Function to update metafield
async function updateProductMetafield(
  productId,
  metafieldId,
  metafieldKey,
  newValue
) {
  const mutation = `mutation {
    productUpdate(input: {
      id: "${productId}",
      metafields:[{
        namespace: "custom",
        key: "${metafieldKey}",
        value: "${newValue}",
        id: "${metafieldId}",
      }]
    }) {
      product {
        metafield(namespace:"custom", key:"${metafieldKey}") {
          namespace,
          id,
          key,
          value
        },
        id
      }
    }
  }`;

  console.log("Mutation:", mutation);

  try {
    const response = await axios.post(
      shopifyGraphQLEndpoint,
      {
        query: mutation,
      },
      {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      }
    );

    if (response.data.errors) {
      console.error("GraphQL errors:", response.data.errors);
      throw new Error("GraphQL errors occurred");
    }
    console.log(response.data.data.productUpdate);
    return "Product metafield updated successfully";
  } catch (error) {
    console.error("Error updating metafield:", error);
    throw error;
  }
}

// Function to update inventory levels
async function updateInventoryScheduled() {
  const vendor = "Nectar";
  try {
    const inventoryItems = await getInventoryItemsByVendor(vendor);
    const locationId = await getLocationIds();
    const inventoryItemIds = inventoryItems.map((item) => ({
      itemId: item.node.variants.edges[0].node.inventoryItem.id,
      locationId: locationId[0].node.id,
    }));
    const inventoryLevels = await updateInventoryLevelsByIds(inventoryItemIds);
    return inventoryLevels;
  } catch (error) {
    return error;
  }
}

// Schedule to run updateInventoryScheduled every hour
cron.schedule("0 * * * *", async () => {
  console.log("Running updateInventoryScheduled");
  try {
    const result = await updateInventoryScheduled();
    console.log("Inventory update result:", result);
  } catch (error) {
    console.error("Error running updateInventoryScheduled:", error);
  }
});

// Endpoint to get inventory items by vendor
app.get("/inventory-items/:vendor", async (req, res) => {
  const vendor = decodeURIComponent(req.params.vendor);
  try {
    const inventoryItems = await getInventoryItemsByVendor(vendor);
    const locationId = await getLocationIds();
    const inventoryItemIds = inventoryItems.map((item) => ({
      itemId: item.node.variants.edges[0].node.inventoryItem.id,
      locationId: locationId[0].node.id,
    }));
    const inventoryLevels = await getInventoryLevelsByIds(inventoryItemIds);
    res.json(inventoryLevels);
  } catch (error) {
    res.status(500).send("Error fetching inventory items");
  }
});

// Endpoint to get product by title
app.get("/product/:title", async (req, res) => {
  const title = decodeURIComponent(req.params.title);
  try {
    const product = await getProductByTitle(title);
    const inventoryItem = await getinventoryItemById(
      product.variants.edges[0].node.inventoryItem.id
    );
    console.log(inventoryItem);
    res.json(product);
  } catch (error) {
    res.status(500).send("Error fetching product");
  }
});

// Endpoint to update metafield
app.post("/update-metafield", async (req, res) => {
  const title = req.body.title;
  const metafieldKey = req.body.metafieldKey;
  const newValue = req.body.newValue;
  try {
    const product = await getProductByTitle(title);
    const metafield = product.metafields.edges.find(
      (mf) => mf.node.key === metafieldKey
    );
    if (metafield) {
      const updatedMetafield = await updateProductMetafield(
        product.id,
        metafield.node.id,
        metafield.node.key,
        newValue
      );
      res.json(updatedMetafield);
    } else {
      res.status(404).send("Metafield not found");
    }
  } catch (error) {
    res.status(500).send("Error updating metafield");
  }
});

// Endpoint to update inventory
app.post("/update-inventory", async (req, res) => {
  const vendor = req.body.vendor;
  try {
    const inventoryItems = await getInventoryItemsByVendor(vendor);
    const locationId = await getLocationIds();
    const inventoryItemIds = inventoryItems.map((item) => ({
      itemId: item.node.variants.edges[0].node.inventoryItem.id,
      locationId: locationId[0].node.id,
    }));
    const inventoryLevels = await updateInventoryLevelsByIds(inventoryItemIds);
    res.json(inventoryLevels);
  } catch (error) {
    res.status(500).send(error);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
