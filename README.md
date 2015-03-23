
  scout distributed database
==============================

this is a database for meshes of "scouts". It manages the meshes as "troops".

It keeps sensor data in 2 views. The last known value and every value that has been sent ever by "report" name ordered by time.

It tracks metadata for troops so you can associate useful attributes. It's nice to name troops for example.

It is fully replicatable and multi master. 
//meshed boards independently create data. its valuable inherently bring this problem but they also bring the solution

terms
-----

- "troop" is a mesh

- "scout" is a node in the mesh

- "troop key" is the value used to associate events with a troop id in this database. it should be secret.

-  "troop id"
    this database manages troop ids as an increment id. this is because the hardware will work best with one mesh of a given id in a particular location. in the case of many troop 1 in the same physical location 

data storage
------------
all changes are written to leveldb immediately. both an append only log section of the database and a view.

these sections are broken up into "sensor data" and "troop data". there is always a cached view of the current key values for any mesh.

As fast resources allow, data is removed from the log portion of the database and packed into "changes" log files. 
These files allow anyone to replicate the data

for each "report" we collect every data point you send. 


log format
----------
all log files are sets of multibuffers (https://www.npmjs.com/package/multibuffer)

[varint][id][binary data]

the first one in any log file will contain it's uuid

the uuid multibuffer only ever contains the uuid [varint][id][uuid] // TODO

uuid multibuffers will be scattered at keyframe intervals throughout the log to enable streaming from arbitrary positions seekabiliity 


replication format
-------------------

i use the dat replication format by default to send data.

https://github.com/mafintosh/dat-replication-protocol









