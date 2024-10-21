const express = require("express");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;
require("dotenv").config();
const { MongoClient, ObjectId, ServerApiVersion } = require("mongodb");

app.use(express.json());
app.use(cors());

const uri =
  "mongodb+srv://ena-ema:bNMLsgaENgFOnag4@cluster0.50l1tkw.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    const taskListCollection = client
      .db("taskManagement")
      .collection("taskList");

    // Create a task
    app.post("/api/tasks", async (req, res) => {
      try {
        const task = req.body;
        const result = await taskListCollection.insertOne(task);
        res.status(201).send(result);
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to create task" });
      }
    });

    // Get all tasks (with optional filtering and searching)

    app.get("/api/tasks", async (req, res) => {
      try {
        const { completed, priority, tags, search } = req.query;
        console.log(search);
        let matchStage = {};

        // Filtering by status (Completed, Pending, All)
        if (completed) {
          matchStage.completed = completed === "true";
        }

        // Filtering by priority
        if (priority) {
          matchStage.priority = priority;
        }

        // Filtering by custom tags
        if (tags) {
          matchStage.tags = { $in: tags.split(",") };
        }

        // Searching by task name or description
        if (search) {
          matchStage.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        // Building the aggregation pipeline
        const tasks = await taskListCollection
          .aggregate([
            {
              $match: matchStage, // Match stage to filter documents
            },
            {
              $sort: {
                completed: 1, // Sort by completed (false first, then true)
              },
            },

            { $unwind: "$tags" },
            {
              $group: {
                _id: "$tags", // Grouping by tags
                count: { $sum: 1 }, // Count of tasks in each tag
                tasks: { $push: "$$ROOT" }, // Push all task documents to the tasks array
              },
            },
            {
              $sort: {
                _id: 1,
              },
            },
            // {
            //   $project: {
            //     _id: 1,
            //     count: 1,
            //     tasks: 1, // Include tasks array in the result
            //   },
            // },
          ])
          .toArray();

        res.send(tasks);
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to fetch tasks" });
      }
    });

    app.get("/api/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        // console.log(id)
        const task = await taskListCollection.findOne({
          _id: new ObjectId(id),
        });
        res.send(task);
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to fetch task" });
      }
    });

    // Update a task
    app.put("/api/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const {_id, name, completed, reminder, description, tags, priority , dueDate } =
          req.body;

        // console.log(updatedTask);
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {  name, completed, reminder, description, tags, priority , dueDate },
        };
        const result = await taskListCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to update task" });
      }
    });

    // Delete a task with undo option
    let deletedTask = null;
    app.delete("/api/tasks/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        deletedTask = await taskListCollection.findOne(filter);
        const result = await taskListCollection.deleteOne(filter);
        res.send(result);
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to delete task" });
      }
    });

    // Undo delete
    app.post("/api/tasks/undo", async (req, res) => {
      try {
        if (deletedTask) {
          await taskListCollection.insertOne(deletedTask);
          deletedTask = null;
          res.send({ success: true });
        } else {
          res.status(400).send({ error: true, message: "No task to undo" });
        }
      } catch (error) {
        res.status(500).send({ error: true, message: "Failed to undo delete" });
      }
    });

    // Mark a task as complete
    app.patch("/api/tasks/:id/complete", async (req, res) => {
      try {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { completed: true } };
        const result = await taskListCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: true, message: "Failed to mark task as complete" });
      }
    });

    // Toggle reminder for a task
    app.patch("/api/tasks/:id/reminder", async (req, res) => {
      try {
        const id = req.params.id;
        const { reminder } = req.body;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { reminder: reminder } };
        const result = await taskListCollection.updateOne(filter, updateDoc);
        res.send(result);
      } catch (error) {
        res
          .status(500)
          .send({ error: true, message: "Failed to toggle reminder" });
      }
    });

    console.log("Backend connected successfully to MongoDB");
  } finally {
    // No need to close the connection explicitly
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
