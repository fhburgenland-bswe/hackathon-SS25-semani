// server.js - Express server with MongoDB integration for chat app
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');


const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Serve static files from the client directory (one level up)
app.use(express.static(path.join(__dirname, '../client')));

// MongoDB Connection String
const uri = "mongodb+srv://semani:O125E33Jo8C8qEsW@cluster0.azieuf5.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

// Database and Collection names
const dbName = 'chat_app';
const messagesCollection = 'messages';
const userPrefsCollection = 'user_preferences';

// Function to create a new MongoDB client and connect
async function connectToMongo() {
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000
  });
  
  try {
    await client.connect();
    return client;
  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw error;
  }
}

// Test the MongoDB connection on startup
async function testConnection() {
  let client;
  try {
    client = await connectToMongo();
    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connection test successful");
    
    // Initialize collections if needed
    const db = client.db(dbName);
    
    // Make sure collections exist
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    if (!collectionNames.includes(messagesCollection)) {
      await db.createCollection(messagesCollection);
      console.log(`Created ${messagesCollection} collection`);
    }
    
    if (!collectionNames.includes(userPrefsCollection)) {
      await db.createCollection(userPrefsCollection);
      console.log(`Created ${userPrefsCollection} collection`);
    }
    
  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
  } finally {
    if (client) {
      await client.close();
      console.log("Initial test connection closed");
    }
  }
}

// Start the server after testing the connection
testConnection()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
      console.log(`Access the application at: http://localhost:${port}`);
    });
  })
  .catch(error => {
    console.error("Server failed to start due to MongoDB connection issues:", error);
    process.exit(1);
  });

// Serve the HTML file for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// API Endpoints

// Get messages for a specific course
app.get('/api/messages/:courseId', async (req, res) => {
  let client;
  
  try {
    client = await connectToMongo();
    const db = client.db(dbName);
    
    const courseId = req.params.courseId;
    const messages = await db.collection(messagesCollection)
      .find({ courseId: courseId })
      .sort({ timestamp: 1 })
      .toArray();
    
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  } finally {
    if (client) {
      await client.close();
      console.log("Connection closed after fetching messages");
    }
  }
});

// Add a new message
app.post('/api/messages', async (req, res) => {
  let client;
  
  try {
    client = await connectToMongo();
    const db = client.db(dbName);
    
    const { courseId, text, userId } = req.body;
    
    if (!courseId || !text) {
      return res.status(400).json({ error: 'CourseId and text are required' });
    }
    
    const newMessage = {
      courseId,
      text,
      userId: userId || 'anonymous', // Make userId optional with a default
      id: new ObjectId().toString(),
      timestamp: new Date(),
      isDeleted: false
    };
    
    await db.collection(messagesCollection).insertOne(newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  } finally {
    if (client) {
      await client.close();
      console.log("Connection closed after adding message");
    }
  }
});

// Update a message
app.put('/api/messages/:messageId', async (req, res) => {
  let client;
  
  try {
    client = await connectToMongo();
    const db = client.db(dbName);
    
    const messageId = req.params.messageId;
    const { text, isDeleted, originalText } = req.body;
    
    const updateData = {};
    if (text !== undefined) updateData.text = text;
    if (isDeleted !== undefined) updateData.isDeleted = isDeleted;
    if (originalText !== undefined) updateData.originalText = originalText;
    
    const result = await db.collection(messagesCollection).updateOne(
      { id: messageId },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const updatedMessage = await db.collection(messagesCollection).findOne({ id: messageId });
    res.json(updatedMessage);
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ error: 'Failed to update message' });
  } finally {
    if (client) {
      await client.close();
      console.log("Connection closed after updating message");
    }
  }
});

// Delete a message (mark as deleted)
app.delete('/api/messages/:messageId', async (req, res) => {
  let client;
  
  try {
    client = await connectToMongo();
    const db = client.db(dbName);
    
    const messageId = req.params.messageId;
    
    // First get the message to save its original text
    const message = await db.collection(messagesCollection).findOne({ id: messageId });
    
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }
    
    const result = await db.collection(messagesCollection).updateOne(
      { id: messageId },
      { 
        $set: { 
          isDeleted: true,
          originalText: message.originalText || message.text,
          text: "Message deleted" 
        } 
      }
    );
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  } finally {
    if (client) {
      await client.close();
      console.log("Connection closed after deleting message");
    }
  }
});

// Get user preference (selected course)
app.get('/api/preferences/:userId', async (req, res) => {
  let client;
  
  try {
    client = await connectToMongo();
    const db = client.db(dbName);
    
    const userId = req.params.userId;
    const preference = await db.collection(userPrefsCollection).findOne({ userId });
    res.json(preference || { selectedCourse: 'mathematik' }); // Default if not found
  } catch (error) {
    console.error('Error fetching user preference:', error);
    res.status(500).json({ error: 'Failed to fetch user preference' });
  } finally {
    if (client) {
      await client.close();
      console.log("Connection closed after fetching preferences");
    }
  }
});

// Save user preference (selected course)
app.post('/api/preferences', async (req, res) => {
  let client;
  
  try {
    client = await connectToMongo();
    const db = client.db(dbName);
    
    const { userId, selectedCourse } = req.body;
    
    if (!userId || !selectedCourse) {
      return res.status(400).json({ error: 'UserId and selectedCourse are required' });
    }
    
    await db.collection(userPrefsCollection).updateOne(
      { userId },
      { $set: { selectedCourse } },
      { upsert: true }
    );
    
    res.status(201).json({ success: true });
  } catch (error) {
    console.error('Error saving user preference:', error);
    res.status(500).json({ error: 'Failed to save user preference' });
  } finally {
    if (client) {
      await client.close();
      console.log("Connection closed after saving preferences");
    }
  }
});

// Add error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});